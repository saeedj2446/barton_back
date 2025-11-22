// src/chat/chat.gateway.ts
import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
    MessageBody,
    ConnectedSocket
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { MessagesService } from '../messages/messages.service';
import { ConversationsService } from '../conversations/conversations.service';
// ❌ این خط رو حذف کن
// import { RedisService } from '../cache/redis.service';

@Injectable()
@WebSocketGateway({
    namespace: '/chat',
    cors: {
        origin: "*",
    },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly logger = new Logger(ChatGateway.name);

    @WebSocketServer()
    server: Server;

    // 🔥 جایگزین Redis با Map ساده
    private onlineUsers = new Map<string, string>(); // userId -> socketId
    private socketToUser = new Map<string, string>(); // socketId -> userId

    constructor(
        private messagesService: MessagesService,
        private conversationsService: ConversationsService,
        // ❌ RedisService رو حذف کن
    ) {}

    // ==================== متدهای جایگزین برای Redis ====================

    private async setUserOnline(userId: string, socketId: string): Promise<boolean> {
        try {
            this.onlineUsers.set(userId, socketId);
            this.socketToUser.set(socketId, userId);
            return true;
        } catch (error) {
            this.logger.error(`Error setting user ${userId} online`, error);
            return false;
        }
    }

    private async setUserOffline(userId: string): Promise<boolean> {
        try {
            const socketId = this.onlineUsers.get(userId);
            if (socketId) {
                this.onlineUsers.delete(userId);
                this.socketToUser.delete(socketId);
            }
            return true;
        } catch (error) {
            this.logger.error(`Error setting user ${userId} offline`, error);
            return false;
        }
    }

    private async isUserOnline(userId: string): Promise<boolean> {
        return this.onlineUsers.has(userId);
    }

    private async getUserSocketId(userId: string): Promise<string | null> {
        return this.onlineUsers.get(userId) || null;
    }

    private async getOnlineUsers(): Promise<string[]> {
        return Array.from(this.onlineUsers.keys());
    }

    private async getOnlineUsersCount(): Promise<number> {
        return this.onlineUsers.size;
    }

    // ==================== متدهای اصلی ====================

    // وقتی کاربر وصل می‌شود
    async handleConnection(client: Socket) {
        try {
            const userId = client.handshake.auth.userId;

            if (!userId) {
                this.logger.warn('Client connected without userId');
                client.disconnect();
                return;
            }

            // 🔥 استفاده از متدهای جایگزین
            const success = await this.setUserOnline(userId, client.id);
            if (!success) {
                this.logger.warn(`Failed to set user ${userId} online`);
            }

            client.data.userId = userId;
            client.join(`user_${userId}`);

            // اطلاع به دیگران که کاربر آنلاین شده
            this.server.emit('user_online', { userId });

            const onlineCount = await this.getOnlineUsersCount();
            this.logger.log(`User ${userId} connected with socket ${client.id}`);
            this.logger.log(`Online users: ${onlineCount}`);

        } catch (error) {
            this.logger.error('Connection error:', error);
            client.disconnect();
        }
    }

    // وقتی کاربر قطع می‌شود
    async handleDisconnect(client: Socket) {
        try {
            const userId = client.data.userId;

            if (userId) {
                // 🔥 استفاده از متدهای جایگزین
                await this.setUserOffline(userId);

                // اطلاع به دیگران که کاربر آفلاین شده
                this.server.emit('user_offline', { userId });

                const onlineCount = await this.getOnlineUsersCount();
                this.logger.log(`User ${userId} disconnected`);
                this.logger.log(`Online users: ${onlineCount}`);
            } else {
                // اگر userId نداریم، از socketToUser پیدا کنیم
                const userIdFromMap = this.socketToUser.get(client.id);
                if (userIdFromMap) {
                    await this.setUserOffline(userIdFromMap);
                    this.server.emit('user_offline', { userId: userIdFromMap });
                }
            }
        } catch (error) {
            this.logger.error('Disconnection error:', error);
        }
    }

    // وقتی کاربر می‌خواهد به یک conversation join شود
    @SubscribeMessage('join_conversation')
    async handleJoinConversation(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { conversationId: string }
    ) {
        try {
            const userId = client.data.userId;
            const { conversationId } = payload;

            if (!userId) {
                client.emit('error', { message: 'کاربر احراز هویت نشده' });
                return;
            }

            client.join(`conversation_${conversationId}`);

            this.logger.log(`User ${userId} joined conversation ${conversationId}`);

            // اطلاع به دیگران در مکالمه که کاربر join شده
            client.to(`conversation_${conversationId}`).emit('user_joined_conversation', {
                conversationId,
                userId: userId
            });

        } catch (error) {
            this.logger.error('Join conversation error:', error);
            client.emit('error', { message: 'خطا در اتصال به مکالمه' });
        }
    }

    // وقتی کاربر از یک conversation خارج می‌شود
    @SubscribeMessage('leave_conversation')
    handleLeaveConversation(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { conversationId: string }
    ) {
        try {
            const { conversationId } = payload;
            client.leave(`conversation_${conversationId}`);

            this.logger.log(`User ${client.data.userId} left conversation ${conversationId}`);

        } catch (error) {
            this.logger.error('Leave conversation error:', error);
        }
    }

    // وقتی کاربر پیام جدید می‌فرستد
    @SubscribeMessage('send_message')
    async handleSendMessage(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: {
            conversationId: string;
            content: string;
        }
    ) {
        try {
            const userId = client.data.userId;

            if (!userId) {
                client.emit('error', { message: 'کاربر احراز هویت نشده' });
                return;
            }

            const { conversationId, content } = payload;

            // ۱. ذخیره پیام در دیتابیس
            const newMessage = await this.messagesService.create(
                {
                    conversation_id: conversationId,
                    content: content,
                },
                userId
            );

            // ۲. دریافت اطلاعات مکالمه برای پیدا کردن کاربر مقابل
            const conversation = await this.conversationsService.getConversation(conversationId, userId);
            const otherUserId = conversation.user1_id === userId ? conversation.user2_id : conversation.user1_id;

            // ۳. ارسال پیام به همه کاربران در آن conversation
            this.server.to(`conversation_${conversationId}`).emit('new_message', {
                message: newMessage,
                conversationId: conversationId
            });

            // ۴. اطلاع به کاربران برای آپدیت لیست مکالمات
            this.server.to(`user_${userId}`).emit('conversation_updated');
            this.server.to(`user_${otherUserId}`).emit('conversation_updated');

            // ۵. اطلاع به کاربر مقابل (اگر آنلاین نیست)
            const isOtherUserOnline = await this.isUserOnline(otherUserId);
            if (!isOtherUserOnline) {
                this.logger.log(`User ${otherUserId} is offline, should send push notification`);
            }

            this.logger.log(`Message sent in conversation ${conversationId} by user ${userId}`);

        } catch (error) {
            this.logger.error('Send message error:', error);
            client.emit('error', {
                message: 'خطا در ارسال پیام',
                error: error.message
            });
        }
    }

    // وقتی کاربر تایپ می‌کند
    @SubscribeMessage('typing_start')
    handleTypingStart(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { conversationId: string }
    ) {
        try {
            const userId = client.data.userId;
            const { conversationId } = payload;

            // اطلاع به دیگران در مکالمه که کاربر در حال تایپ است
            client.to(`conversation_${conversationId}`).emit('user_typing', {
                conversationId,
                userId,
                isTyping: true
            });

        } catch (error) {
            this.logger.error('Typing start error:', error);
        }
    }

    @SubscribeMessage('typing_stop')
    handleTypingStop(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { conversationId: string }
    ) {
        try {
            const userId = client.data.userId;
            const { conversationId } = payload;

            // اطلاع به دیگران در مکالمه که کاربر تایپ را متوقف کرد
            client.to(`conversation_${conversationId}`).emit('user_typing', {
                conversationId,
                userId,
                isTyping: false
            });

        } catch (error) {
            this.logger.error('Typing stop error:', error);
        }
    }

    // وقتی کاربر پیام را می‌خواند
    @SubscribeMessage('mark_as_read')
    async handleMarkAsRead(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { messageId: string; conversationId: string }
    ) {
        try {
            const userId = client.data.userId;
            const { messageId, conversationId } = payload;

            await this.messagesService.markAsRead(messageId, userId);

            // اطلاع به فرستنده که پیام خوانده شده
            this.server.to(`conversation_${conversationId}`).emit('message_read', {
                messageId,
                readBy: userId,
                readAt: new Date()
            });

            this.logger.log(`Message ${messageId} marked as read by user ${userId}`);

        } catch (error) {
            this.logger.error('Mark as read error:', error);
            client.emit('error', { message: 'خطا در علامت زدن پیام به عنوان خوانده شده' });
        }
    }

    // وقتی کاربر تمام پیام‌های یک مکالمه را می‌خواند
    @SubscribeMessage('mark_conversation_read')
    async handleMarkConversationRead(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { conversationId: string }
    ) {
        try {
            const userId = client.data.userId;
            const { conversationId } = payload;

            await this.conversationsService.markConversationAsRead(conversationId, userId);

            // اطلاع به کاربر مقابل
            const conversation = await this.conversationsService.getConversation(conversationId, userId);
            const otherUserId = conversation.user1_id === userId ? conversation.user2_id : conversation.user1_id;

            this.server.to(`user_${otherUserId}`).emit('conversation_read', {
                conversationId,
                readBy: userId
            });

            this.logger.log(`Conversation ${conversationId} marked as read by user ${userId}`);

        } catch (error) {
            this.logger.error('Mark conversation read error:', error);
        }
    }

    // بررسی وضعیت آنلاین کاربران
    @SubscribeMessage('check_online_status')
    async handleCheckOnlineStatus(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { userIds: string[] }
    ) {
        try {
            const onlineStatuses = await Promise.all(
                payload.userIds.map(async (userId) => ({
                    userId,
                    isOnline: await this.isUserOnline(userId),
                    lastSeen: null
                }))
            );

            client.emit('online_statuses', onlineStatuses);

        } catch (error) {
            this.logger.error('Check online status error:', error);
        }
    }

    // متدهای کمکی - دیگر نیازی به جستجو در Redis نیست
    private getUserIdBySocketId(socketId: string): string | null {
        return this.socketToUser.get(socketId) || null;
    }

    // متد عمومی برای ارسال نوتیفیکیشن
    public async sendNotificationToUser(userId: string, notification: any) {
        const isOnline = await this.isUserOnline(userId);
        if (isOnline) {
            this.server.to(`user_${userId}`).emit('notification', notification);
        } else {
            this.logger.log(`User ${userId} is offline, sending push notification`);
        }
    }

    // متد عمومی برای ارسال پیام به کاربر
    public async sendMessageToUser(userId: string, event: string, data: any) {
        const isOnline = await this.isUserOnline(userId);
        if (isOnline) {
            this.server.to(`user_${userId}`).emit(event, data);
            return true;
        }
        return false;
    }
}