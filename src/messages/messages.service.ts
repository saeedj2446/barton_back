// src/messages/messages.service.ts
import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { MessageQueryDto } from './dto/message-query.dto';
import { FileUsage, Prisma, Language, Message as PrismaMessage } from '@prisma/client';

@Injectable()
export class MessagesService {
    constructor(private prisma: PrismaService) {}

    private readonly DEFAULT_LANGUAGE = Language.fa;

    // متد کمکی برای includeهای پیام
    private getMessageInclude(language: Language = this.DEFAULT_LANGUAGE): Prisma.MessageInclude {
        return {
            sender: {
                select: {
                    id: true,
                    user_name: true,
                    is_verified: true,
                    contents: {
                        where: { language },
                        select: { first_name: true, last_name: true }
                    },
                    files: {
                        where: {
                            file_usage: FileUsage.PROFILE_PHOTO
                        },
                        take: 1,
                        select: {
                            file_path: true,
                            thumbnail_path: true
                        }
                    }
                }
            },
            conversation: {
                include: {
                    user1: {
                        select: {
                            id: true,
                            user_name: true,
                            contents: {
                                where: { language },
                                select: { first_name: true, last_name: true }
                            }
                        }
                    },
                    user2: {
                        select: {
                            id: true,
                            user_name: true,
                            contents: {
                                where: { language },
                                select: { first_name: true, last_name: true }
                            }
                        }
                    }
                }
            }
        };
    }

    // ایجاد پیام جدید
    // src/messages/messages.service.ts (بخش createMessage اصلاح شده)
    async create(createMessageDto: CreateMessageDto, userId: string, language: Language = this.DEFAULT_LANGUAGE) {
        const { conversation_id, content, reply_to_message_id } = createMessageDto;

        // بررسی وجود مکالمه
        const conversation = await this.prisma.conversation.findUnique({
            where: { id: conversation_id },
            include: {
                user1: true,
                user2: true
            }
        });

        if (!conversation) {
            throw new NotFoundException('مکالمه یافت نشد');
        }

        // بررسی دسترسی کاربر به مکالمه
        if (conversation.user1_id !== userId && conversation.user2_id !== userId) {
            throw new ForbiddenException('دسترسی به این مکالمه ندارید');
        }

        // بررسی پیام پاسخ (اگر وجود دارد)
        let repliedMessage = null;
        if (reply_to_message_id) {
            repliedMessage = await this.prisma.message.findUnique({
                where: { id: reply_to_message_id },
                include: { conversation: true }
            });

            if (!repliedMessage) {
                throw new NotFoundException('پیام مورد نظر برای پاسخ یافت نشد');
            }

            if (repliedMessage.conversation_id !== conversation_id) {
                throw new BadRequestException('پیام پاسخ متعلق به این مکالمه نیست');
            }
        }

        return await this.prisma.$transaction(async (tx) => {
            // ایجاد پیام جدید با استفاده از any برای دور زدن بررسی نوع TypeScript
            const messageData: any = {
                content,
                sender: { connect: { id: userId } },
                conversation: { connect: { id: conversation_id } }
            };

            // اگر پیام پاسخ وجود دارد، آن را اضافه کن
            if (reply_to_message_id) {
                messageData.reply_to_message = { connect: { id: reply_to_message_id } };
            }

            const message = await tx.message.create({
                data: messageData,
                include: this.getMessageInclude(language)
            });

            // آپدیت اطلاعات آخرین پیام در مکالمه
            await tx.conversation.update({
                where: { id: conversation_id },
                data: {
                    last_message_text: this.truncateMessage(content),
                    last_message_time: new Date(),
                    updated_at: new Date()
                }
            });

            // بازنشانی وضعیت خواندن برای کاربر مقابل
            const otherUserId = conversation.user1_id === userId ? conversation.user2_id : conversation.user1_id;

            // تمام پیام‌های قبلی کاربر فعلی را به عنوان خوانده شده علامت بزن
            await tx.message.updateMany({
                where: {
                    conversation_id,
                    sender_id: userId,
                    is_read: false
                },
                data: { is_read: true }
            });

            return this.processMessageResult(message, userId, language);
        });
    }

// متد کمکی برای کوتاه کردن متن پیام
    private truncateMessage(content: string, maxLength: number = 100): string {
        return content.length > maxLength ? content.substring(0, maxLength) + '...' : content;
    }

    // دریافت پیام‌های یک مکالمه (با پشتیبانی از اسکرول بی‌نهایت)
    async getConversationMessages(
        conversationId: string,
        userId: string,
        query: MessageQueryDto & { language?: Language }
    ) {
        const { page = 1, limit = 50, before } = query;
        const skip = (page - 1) * limit;

        // بررسی وجود مکالمه و دسترسی
        const conversation = await this.prisma.conversation.findUnique({
            where: { id: conversationId }
        });

        if (!conversation) {
            throw new NotFoundException('مکالمه یافت نشد');
        }

        if (conversation.user1_id !== userId && conversation.user2_id !== userId) {
            throw new ForbiddenException('دسترسی به این مکالمه ندارید');
        }

        // ساخت شرط‌های فیلتر برای اسکرول بی‌نهایت
        const where: Prisma.MessageWhereInput = {
            conversation_id: conversationId
        };

        // اگر پارامتر before وجود دارد، برای اسکرول بی‌نهایت استفاده می‌شود
        if (before) {
            where.created_at = { lt: new Date(before) };
        }

        const [messages, total] = await Promise.all([
            this.prisma.message.findMany({
                where,
                include: this.getMessageInclude(query.language || this.DEFAULT_LANGUAGE),
                orderBy: { created_at: 'desc' }, // جدیدترین اول برای اسکرول بی‌نهایت
                skip: before ? 0 : skip, // برای اسکرول بی‌نهایت از skip استفاده نمی‌کنیم
                take: limit
            }),
            this.prisma.message.count({ where: { conversation_id: conversationId } })
        ]);

        // علامت گذاری پیام‌های دریافتی جدید به عنوان خوانده شده
        if (messages.length > 0) {
            const unreadMessages = messages.filter(msg =>
                msg.sender_id !== userId && !msg.is_read
            );

            if (unreadMessages.length > 0) {
                await this.markMessagesAsRead(
                    unreadMessages.map(msg => msg.id),
                    userId
                );
            }
        }

        // پردازش نتایج
        const processedMessages = await Promise.all(
            messages.map(message =>
                this.processMessageResult(message, userId, query.language || this.DEFAULT_LANGUAGE)
            )
        );

        // محاسبه اطلاعات صفحه‌بندی برای اسکرول بی‌نهایت
        const hasMore = messages.length === limit;
        const nextCursor = hasMore && messages.length > 0
            ? messages[messages.length - 1].created_at.toISOString()
            : null;

        return {
            data: processedMessages,
            meta: {
                page: before ? null : page, // برای اسکرول بی‌نهایت page معنی ندارد
                limit,
                total,
                has_more: hasMore,
                next_cursor: nextCursor,
                total_pages: before ? null : Math.ceil(total / limit)
            }
        };
    }

    // دریافت یک پیام خاص
    async getMessage(id: string, userId: string, language: Language = this.DEFAULT_LANGUAGE) {
        const message = await this.prisma.message.findUnique({
            where: { id },
            include: {
                ...this.getMessageInclude(language),
                reply_to_message: {
                    include: {
                        sender: {
                            select: {
                                id: true,
                                user_name: true,
                                contents: {
                                    where: { language },
                                    select: { first_name: true, last_name: true }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!message) {
            throw new NotFoundException('پیام یافت نشد');
        }

        // بررسی دسترسی کاربر به پیام
        const conversation = await this.prisma.conversation.findUnique({
            where: { id: message.conversation_id }
        });

        if (!conversation || (conversation.user1_id !== userId && conversation.user2_id !== userId)) {
            throw new ForbiddenException('دسترسی به این پیام ندارید');
        }

        // اگر پیام از طرف کاربر مقابل است و خوانده نشده، آن را علامت بزن
        if (message.sender_id !== userId && !message.is_read) {
            await this.markMessagesAsRead([id], userId);
        }

        return this.processMessageResult(message, userId, language);
    }

    // ویرایش پیام
    async updateMessage(id: string, content: string, userId: string, language: Language = this.DEFAULT_LANGUAGE) {
        const message = await this.prisma.message.findUnique({
            where: { id },
            include: { conversation: true }
        });

        if (!message) {
            throw new NotFoundException('پیام یافت نشد');
        }

        // بررسی مالکیت پیام
        if (message.sender_id !== userId) {
            throw new ForbiddenException('شما مجاز به ویرایش این پیام نیستید');
        }

        // بررسی زمان ویرایش (مثلاً فقط در ۵ دقیقه اول امکان ویرایش)
        const editTimeLimit = 5 * 60 * 1000; // 5 دقیقه
        const timeSinceCreation = Date.now() - message.created_at.getTime();

        if (timeSinceCreation > editTimeLimit) {
            throw new BadRequestException('زمان ویرایش پیام به پایان رسیده است');
        }

        const updatedMessage = await this.prisma.message.update({
            where: { id },
            data: {
                content,
                // می‌توانید فیلد edited_at هم اضافه کنید اگر نیاز است
            },
            include: this.getMessageInclude(language)
        });

        // اگر این پیام آخرین پیام مکالمه است، اطلاعات آخرین پیام را آپدیت کن
        const lastMessage = await this.prisma.message.findFirst({
            where: { conversation_id: message.conversation_id },
            orderBy: { created_at: 'desc' },
            take: 1
        });

        if (lastMessage && lastMessage.id === id) {
            await this.prisma.conversation.update({
                where: { id: message.conversation_id },
                data: {
                    last_message_text: content.length > 100 ? content.substring(0, 100) + '...' : content,
                    updated_at: new Date()
                }
            });
        }

        return this.processMessageResult(updatedMessage, userId, language);
    }

    // حذف پیام
    async deleteMessage(id: string, userId: string) {
        const message = await this.prisma.message.findUnique({
            where: { id },
            include: { conversation: true }
        });

        if (!message) {
            throw new NotFoundException('پیام یافت نشد');
        }

        // بررسی دسترسی (فقط فرستنده می‌تواند پیام خود را حذف کند)
        if (message.sender_id !== userId) {
            throw new ForbiddenException('شما مجاز به حذف این پیام نیستید');
        }

        await this.prisma.message.delete({
            where: { id }
        });

        // بررسی و آپدیت آخرین پیام مکالمه اگر لازم است
        await this.updateConversationLastMessage(message.conversation_id);

        return { message: 'پیام با موفقیت حذف شد' };
    }

    // علامت گذاری پیام‌ها به عنوان خوانده شده
    async markMessagesAsRead(messageIds: string[], userId: string) {
        if (messageIds.length === 0) {
            return { count: 0 };
        }

        // بررسی دسترسی کاربر به پیام‌ها
        const messages = await this.prisma.message.findMany({
            where: {
                id: { in: messageIds },
                is_read: false,
                sender_id: { not: userId } // کاربر فقط می‌تواند پیام‌های دیگران را علامت بزند
            },
            include: {
                conversation: true
            }
        });

        // فیلتر پیام‌هایی که کاربر به آنها دسترسی دارد
        const accessibleMessageIds = messages
            .filter(msg =>
                msg.conversation.user1_id === userId ||
                msg.conversation.user2_id === userId
            )
            .map(msg => msg.id);

        if (accessibleMessageIds.length === 0) {
            return { count: 0 };
        }

        const result = await this.prisma.message.updateMany({
            where: {
                id: { in: accessibleMessageIds },
                is_read: false
            },
            data: { is_read: true }
        });

        // آپدیت زمان خواندن در مکالمه
        const conversationIds = [...new Set(messages.map(msg => msg.conversation_id))];

        for (const conversationId of conversationIds) {
            const conversation = messages.find(msg => msg.conversation_id === conversationId)?.conversation;
            if (conversation) {
                const updateData: Prisma.ConversationUpdateInput = {};
                if (conversation.user1_id === userId) {
                    updateData.user1_last_read_at = new Date();
                } else {
                    updateData.user2_last_read_at = new Date();
                }

                await this.prisma.conversation.update({
                    where: { id: conversationId },
                    data: updateData
                });
            }
        }

        return { count: result.count };
    }

    // جستجو در پیام‌های یک مکالمه
    async searchMessages(
        conversationId: string,
        userId: string,
        searchTerm: string,
        language: Language = this.DEFAULT_LANGUAGE
    ) {
        // بررسی دسترسی به مکالمه
        const conversation = await this.prisma.conversation.findUnique({
            where: { id: conversationId }
        });

        if (!conversation || (conversation.user1_id !== userId && conversation.user2_id !== userId)) {
            throw new ForbiddenException('دسترسی به این مکالمه ندارید');
        }

        const messages = await this.prisma.message.findMany({
            where: {
                conversation_id: conversationId,
                content: {
                    contains: searchTerm,
                    mode: 'insensitive'
                }
            },
            include: this.getMessageInclude(language),
            orderBy: { created_at: 'desc' },
            take: 100 // محدودیت برای جستجو
        });

        const processedMessages = await Promise.all(
            messages.map(message => this.processMessageResult(message, userId, language))
        );

        return {
            data: processedMessages,
            meta: {
                search_term: searchTerm,
                total_results: messages.length
            }
        };
    }

    // پردازش نتیجه پیام
    private async processMessageResult(message: any, userId: string, language: Language) {
        const isSender = message.sender_id === userId;
        const senderContent = message.sender.contents?.[0];

        // اگر پیام پاسخ دارد، اطلاعات آن را پردازش کن
        let repliedMessageInfo = null;
        if (message.reply_to_message) {
            const repliedContent = message.reply_to_message.sender.contents?.[0];
            repliedMessageInfo = {
                id: message.reply_to_message.id,
                content: message.reply_to_message.content,
                sender: {
                    id: message.reply_to_message.sender.id,
                    user_name: message.reply_to_message.sender.user_name,
                    first_name: repliedContent?.first_name,
                    last_name: repliedContent?.last_name,
                    full_name: [repliedContent?.first_name, repliedContent?.last_name]
                        .filter(Boolean).join(' ') || message.reply_to_message.sender.user_name
                },
                created_at: message.reply_to_message.created_at
            };
        }

        return {
            // اطلاعات اصلی پیام
            id: message.id,
            content: message.content,
            created_at: message.created_at,
            is_read: message.is_read,
            is_sender: isSender,

            // اطلاعات فرستنده
            sender: {
                id: message.sender.id,
                user_name: message.sender.user_name,
                first_name: senderContent?.first_name,
                last_name: senderContent?.last_name,
                full_name: [senderContent?.first_name, senderContent?.last_name]
                    .filter(Boolean).join(' ') || message.sender.user_name,
                is_verified: message.sender.is_verified,
                profile_photo: message.sender.files?.[0] || null
            },

            // اطلاعات مکالمه
            conversation_id: message.conversation_id,

            // اطلاعات پیام پاسخ
            reply_to_message: repliedMessageInfo,

            // اطلاعات اضافی
            is_edited: false // اگر فیلد edited_at دارید، اینجا چک کنید
        };
    }

    // متد کمکی برای آپدیت آخرین پیام مکالمه
    private async updateConversationLastMessage(conversationId: string) {
        const lastMessage = await this.prisma.message.findFirst({
            where: { conversation_id: conversationId },
            orderBy: { created_at: 'desc' },
            take: 1
        });

        const updateData: Prisma.ConversationUpdateInput = {
            updated_at: new Date()
        };

        if (lastMessage) {
            updateData.last_message_text = lastMessage.content.length > 100 ?
                lastMessage.content.substring(0, 100) + '...' : lastMessage.content;
            updateData.last_message_time = lastMessage.created_at;
        } else {
            updateData.last_message_text = null;
            updateData.last_message_time = null;
        }

        await this.prisma.conversation.update({
            where: { id: conversationId },
            data: updateData
        });
    }

    // دریافت تعداد پیام‌های نخوانده
    async getUnreadMessagesCount(userId: string): Promise<number> {
        return this.prisma.message.count({
            where: {
                conversation: {
                    OR: [
                        { user1_id: userId },
                        { user2_id: userId }
                    ]
                },
                sender_id: { not: userId },
                is_read: false
            }
        });
    }

    // دریافت آخرین فعالیت‌های پیام‌رسانی
    async getMessagingActivity(userId: string, days: number = 7) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const [sentCount, receivedCount, unreadCount] = await Promise.all([
            // تعداد پیام‌های ارسالی
            this.prisma.message.count({
                where: {
                    sender_id: userId,
                    created_at: { gte: startDate }
                }
            }),
            // تعداد پیام‌های دریافتی
            this.prisma.message.count({
                where: {
                    conversation: {
                        OR: [
                            { user1_id: userId },
                            { user2_id: userId }
                        ]
                    },
                    sender_id: { not: userId },
                    created_at: { gte: startDate }
                }
            }),
            // تعداد پیام‌های نخوانده
            this.getUnreadMessagesCount(userId)
        ]);

        return {
            period_days: days,
            start_date: startDate,
            end_date: new Date(),
            sent_messages: sentCount,
            received_messages: receivedCount,
            unread_messages: unreadCount,
            total_messages: sentCount + receivedCount
        };
    }

    // به messages.service.ts این متدها را اضافه کنید:

// دریافت تمام پیام‌ها برای ادمین
    async findAllForAdmin(query: any & { language?: Language }) {
        const {
            page = 1,
            limit = 50,
            conversationId,
            userId,
            language = this.DEFAULT_LANGUAGE
        } = query;
        const skip = (page - 1) * limit;

        const where: Prisma.MessageWhereInput = {};

        if (conversationId) {
            where.conversation_id = conversationId;
        }

        if (userId) {
            where.sender_id = userId;
        }

        const [messages, total] = await Promise.all([
            this.prisma.message.findMany({
                where,
                include: this.getMessageIncludeForAdmin(language),
                orderBy: { created_at: 'desc' },
                skip,
                take: limit
            }),
            this.prisma.message.count({ where })
        ]);

        const processedMessages = await Promise.all(
            messages.map(message => this.processMessageResultForAdmin(message, language))
        );

        return {
            data: processedMessages,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

// دریافت اطلاعات کامل یک پیام برای ادمین
    async getMessageForAdmin(id: string, language: Language = this.DEFAULT_LANGUAGE) {
        const message = await this.prisma.message.findUnique({
            where: { id },
            include: this.getMessageIncludeForAdmin(language)
        });

        if (!message) {
            throw new NotFoundException('پیام یافت نشد');
        }

        return this.processMessageResultForAdmin(message, language);
    }

// دریافت پیام‌های یک مکالمه برای ادمین
    async getConversationMessagesForAdmin(conversationId: string, query: any & { language?: Language }) {
        const { page = 1, limit = 50, language = this.DEFAULT_LANGUAGE } = query;
        const skip = (page - 1) * limit;

        // بررسی وجود مکالمه
        const conversation = await this.prisma.conversation.findUnique({
            where: { id: conversationId }
        });

        if (!conversation) {
            throw new NotFoundException('مکالمه یافت نشد');
        }

        const [messages, total] = await Promise.all([
            this.prisma.message.findMany({
                where: { conversation_id: conversationId },
                include: this.getMessageIncludeForAdmin(language),
                orderBy: { created_at: 'desc' },
                skip,
                take: limit
            }),
            this.prisma.message.count({ where: { conversation_id: conversationId } })
        ]);

        const processedMessages = await Promise.all(
            messages.map(message => this.processMessageResultForAdmin(message, language))
        );

        return {
            data: processedMessages,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

// حذف پیام توسط ادمین
    async deleteMessageForAdmin(id: string) {
        const message = await this.prisma.message.findUnique({
            where: { id }
        });

        if (!message) {
            throw new NotFoundException('پیام یافت نشد');
        }

        await this.prisma.message.delete({
            where: { id }
        });

        // آپدیت آخرین پیام مکالمه اگر لازم است
        await this.updateConversationLastMessage(message.conversation_id);

        return { message: 'پیام با موفقیت حذف شد' };
    }

// دریافت پیام‌های یک کاربر برای ادمین
    async getUserMessagesForAdmin(userId: string, query: any & { language?: Language }) {
        const { page = 1, limit = 50, language = this.DEFAULT_LANGUAGE } = query;
        const skip = (page - 1) * limit;

        // بررسی وجود کاربر
        const user = await this.prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            throw new NotFoundException('کاربر یافت نشد');
        }

        const [messages, total] = await Promise.all([
            this.prisma.message.findMany({
                where: { sender_id: userId },
                include: this.getMessageIncludeForAdmin(language),
                orderBy: { created_at: 'desc' },
                skip,
                take: limit
            }),
            this.prisma.message.count({ where: { sender_id: userId } })
        ]);

        const processedMessages = await Promise.all(
            messages.map(message => this.processMessageResultForAdmin(message, language))
        );

        return {
            data: processedMessages,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

// آمار کلی پیام‌رسانی پلتفرم
    async getPlatformMessagingStatistics(days: number = 30) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const [
            totalMessages,
            sentMessages,
            unreadMessages,
            activeConversations,
            topSenders
        ] = await Promise.all([
            // کل پیام‌ها
            this.prisma.message.count({
                where: { created_at: { gte: startDate } }
            }),
            // پیام‌های ارسالی
            this.prisma.message.count({
                where: { created_at: { gte: startDate } }
            }),
            // پیام‌های نخوانده
            this.prisma.message.count({
                where: {
                    created_at: { gte: startDate },
                    is_read: false
                }
            }),
            // مکالمات فعال
            this.prisma.conversation.count({
                where: {
                    updated_at: { gte: startDate }
                }
            }),
            // پرکاربردترین کاربران
            this.prisma.message.groupBy({
                by: ['sender_id'],
                where: { created_at: { gte: startDate } },
                _count: { id: true },
                orderBy: { _count: { id: 'desc' } },
                take: 10
            })
        ]);

        // گرفتن اطلاعات کاربران پرکاربرد
        const topSendersWithDetails = await Promise.all(
            topSenders.map(async (sender) => {
                const user = await this.prisma.user.findUnique({
                    where: { id: sender.sender_id },
                    select: {
                        id: true,
                        user_name: true,
                        contents: {
                            where: { language: this.DEFAULT_LANGUAGE },
                            select: { first_name: true, last_name: true }
                        }
                    }
                });

                return {
                    user_id: sender.sender_id,
                    user_name: user?.user_name,
                    full_name: user?.contents[0] ?
                        `${user.contents[0].first_name} ${user.contents[0].last_name}` :
                        'نامشخص',
                    message_count: sender._count.id
                };
            })
        );

        return {
            period_days: days,
            start_date: startDate,
            end_date: new Date(),
            statistics: {
                total_messages: totalMessages,
                sent_messages: sentMessages,
                unread_messages: unreadMessages,
                active_conversations: activeConversations,
                average_messages_per_day: Math.round(totalMessages / days)
            },
            top_senders: topSendersWithDetails
        };
    }

// متد کمکی برای includeهای ادمین
    private getMessageIncludeForAdmin(language: Language = this.DEFAULT_LANGUAGE): Prisma.MessageInclude {
        return {
            sender: {
                select: {
                    id: true,
                    user_name: true,
                    is_verified: true,
                    mobile: true,
                    email: true,
                    is_blocked: true,
                    contents: {
                        where: { language },
                        select: { first_name: true, last_name: true }
                    },
                    files: {
                        where: {
                            file_usage: FileUsage.PROFILE_PHOTO
                        },
                        take: 1,
                        select: {
                            file_path: true,
                            thumbnail_path: true
                        }
                    }
                }
            },
            conversation: {
                include: {
                    user1: {
                        select: {
                            id: true,
                            user_name: true,
                            mobile: true,
                            contents: {
                                where: { language },
                                select: { first_name: true, last_name: true }
                            }
                        }
                    },
                    user2: {
                        select: {
                            id: true,
                            user_name: true,
                            mobile: true,
                            contents: {
                                where: { language },
                                select: { first_name: true, last_name: true }
                            }
                        }
                    }
                }
            },
            reply_to_message: {
                include: {
                    sender: {
                        select: {
                            id: true,
                            user_name: true,
                            contents: {
                                where: { language },
                                select: { first_name: true, last_name: true }
                            }
                        }
                    }
                }
            }
        };
    }

// پردازش نتیجه پیام برای ادمین
    private async processMessageResultForAdmin(message: any, language: Language) {
        const senderContent = message.sender.contents?.[0];

        let repliedMessageInfo = null;
        if (message.reply_to_message) {
            const repliedContent = message.reply_to_message.sender.contents?.[0];
            repliedMessageInfo = {
                id: message.reply_to_message.id,
                content: message.reply_to_message.content,
                sender: {
                    id: message.reply_to_message.sender.id,
                    user_name: message.reply_to_message.sender.user_name,
                    first_name: repliedContent?.first_name,
                    last_name: repliedContent?.last_name,
                    full_name: [repliedContent?.first_name, repliedContent?.last_name]
                        .filter(Boolean).join(' ') || message.reply_to_message.sender.user_name
                },
                created_at: message.reply_to_message.created_at
            };
        }

        return {
            // اطلاعات اصلی پیام
            id: message.id,
            content: message.content,
            created_at: message.created_at,
            is_read: message.is_read,

            // اطلاعات کامل فرستنده
            sender: {
                id: message.sender.id,
                user_name: message.sender.user_name,
                first_name: senderContent?.first_name,
                last_name: senderContent?.last_name,
                full_name: [senderContent?.first_name, senderContent?.last_name]
                    .filter(Boolean).join(' ') || message.sender.user_name,
                is_verified: message.sender.is_verified,
                mobile: message.sender.mobile,
                email: message.sender.email,
                is_blocked: message.sender.is_blocked,
                profile_photo: message.sender.files?.[0] || null
            },

            // اطلاعات کامل مکالمه
            conversation_id: message.conversation_id,
            conversation: {
                id: message.conversation.id,
                user1: message.conversation.user1,
                user2: message.conversation.user2,
                created_at: message.conversation.created_at,
                updated_at: message.conversation.updated_at
            },

            // اطلاعات پیام پاسخ
            reply_to_message: repliedMessageInfo,

            // اطلاعات اضافی برای ادمین
            is_edited: false
        };
    }

    // به messages.service.ts این متدها را اضافه کنید:

// ۱. دریافت کاربرانی که بیشترین چت را دارند
    async getTopChattingUsers(days: number = 7, limit: number = 20) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const topUsers = await this.prisma.message.groupBy({
            by: ['sender_id'],
            where: {
                created_at: { gte: startDate }
            },
            _count: {
                id: true
            },
            _max: {
                created_at: true
            },
            orderBy: {
                _count: {
                    id: 'desc'
                }
            },
            take: limit
        });

        // گرفتن اطلاعات کامل کاربران
        const usersWithDetails = await Promise.all(
            topUsers.map(async (userStat) => {
                const user = await this.prisma.user.findUnique({
                    where: { id: userStat.sender_id },
                    include: {
                        contents: {
                            where: { language: this.DEFAULT_LANGUAGE },
                            select: { first_name: true, last_name: true, company: true }
                        },
                        // 🔧 اصلاح شده: استفاده از account_users به جای accounts
                        account_users: {
                            include: {
                                account: {
                                    include: {
                                        contents: {
                                            where: { language: this.DEFAULT_LANGUAGE },
                                            select: { name: true }
                                        },
                                        industry: {
                                            include: {
                                                contents: {
                                                    where: { language: this.DEFAULT_LANGUAGE },
                                                    select: { name: true }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                });

                // آخرین فعالیت کاربر
                const lastActivity = await this.prisma.message.findFirst({
                    where: { sender_id: userStat.sender_id },
                    orderBy: { created_at: 'desc' },
                    select: { created_at: true, conversation_id: true }
                });

                return {
                    user: {
                        id: user?.id,
                        user_name: user?.user_name,
                        mobile: user?.mobile,
                        email: user?.email,
                        first_name: user?.contents[0]?.first_name,
                        last_name: user?.contents[0]?.last_name,
                        company: user?.contents[0]?.company,
                        // 🔧 اصلاح شده: استفاده از account_users
                        accounts: user?.account_users.map(acc => ({
                            name: acc.account.contents[0]?.name,
                            industry: acc.account.industry?.contents[0]?.name,
                            account_role: acc.account_role
                        }))
                    },
                    statistics: {
                        total_messages: userStat._count.id,
                        last_message_date: userStat._max.created_at,
                        last_activity: lastActivity?.created_at
                    }
                };
            })
        );

        return {
            period_days: days,
            top_chatting_users: usersWithDetails
        };
    }

// ۲. دریافت چت‌های مرتبط با درخواست‌های خرید
    async getBuyAdConversations(days: number = 30, page: number = 1, limit: number = 20) {
        const skip = (page - 1) * limit;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const [conversations, total] = await Promise.all([
            this.prisma.conversation.findMany({
                where: {
                    buy_ad_id: { not: null },
                    created_at: { gte: startDate }
                },
                include: {
                    user1: {
                        select: {
                            id: true,
                            user_name: true,
                            contents: {
                                where: { language: this.DEFAULT_LANGUAGE },
                                select: { first_name: true, last_name: true, company: true }
                            }
                        }
                    },
                    user2: {
                        select: {
                            id: true,
                            user_name: true,
                            contents: {
                                where: { language: this.DEFAULT_LANGUAGE },
                                select: { first_name: true, last_name: true, company: true }
                            }
                        }
                    },
                    buyAd: {
                        include: {
                            contents: {
                                where: { language: this.DEFAULT_LANGUAGE },
                                select: { name: true, description: true }
                            },
                            account: {
                                include: {
                                    contents: {
                                        where: { language: this.DEFAULT_LANGUAGE },
                                        select: { name: true }
                                    }
                                }
                            }
                        }
                    },
                    messages: {
                        take: 5,
                        orderBy: { created_at: 'desc' },
                        include: {
                            sender: {
                                select: {
                                    id: true,
                                    user_name: true,
                                    contents: {
                                        where: { language: this.DEFAULT_LANGUAGE },
                                        select: { first_name: true, last_name: true }
                                    }
                                }
                            }
                        }
                    },
                    _count: {
                        select: {
                            messages: true
                        }
                    }
                },
                orderBy: { updated_at: 'desc' },
                skip,
                take: limit
            }),
            this.prisma.conversation.count({
                where: {
                    buy_ad_id: { not: null },
                    created_at: { gte: startDate }
                }
            })
        ]);

        const processedConversations = conversations.map(conversation => ({
            id: conversation.id,
            created_at: conversation.created_at,
            updated_at: conversation.updated_at,
            last_message_text: conversation.last_message_text,
            participants: {
                user1: {
                    id: conversation.user1.id,
                    name: `${conversation.user1.contents[0]?.first_name || ''} ${conversation.user1.contents[0]?.last_name || ''}`.trim() || conversation.user1.user_name,
                    company: conversation.user1.contents[0]?.company
                },
                user2: {
                    id: conversation.user2.id,
                    name: `${conversation.user2.contents[0]?.first_name || ''} ${conversation.user2.contents[0]?.last_name || ''}`.trim() || conversation.user2.user_name,
                    company: conversation.user2.contents[0]?.company
                }
            },
            buy_ad: conversation.buyAd ? {
                id: conversation.buyAd.id,
                name: conversation.buyAd.contents[0]?.name,
                description: conversation.buyAd.contents[0]?.description,
                requirement_amount: conversation.buyAd.requirement_amount,
                unit: conversation.buyAd.unit,
                account: conversation.buyAd.account.contents[0]?.name
            } : null,
            message_count: conversation._count.messages,
            recent_messages: conversation.messages.map(msg => ({
                id: msg.id,
                content: msg.content,
                created_at: msg.created_at,
                sender: {
                    id: msg.sender.id,
                    name: `${msg.sender.contents[0]?.first_name || ''} ${msg.sender.contents[0]?.last_name || ''}`.trim() || msg.sender.user_name
                }
            }))
        }));

        return {
            data: processedConversations,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

// ۳. دریافت چت‌های یک کاربر خاص
    async getUserConversationsForAdmin(userId: string, days: number = 30) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // بررسی وجود کاربر
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                contents: {
                    where: { language: this.DEFAULT_LANGUAGE },
                    select: { first_name: true, last_name: true, company: true }
                }
            }
        });

        if (!user) {
            throw new NotFoundException('کاربر یافت نشد');
        }

        const conversations = await this.prisma.conversation.findMany({
            where: {
                OR: [
                    { user1_id: userId },
                    { user2_id: userId }
                ],
                created_at: { gte: startDate }
            },
            include: {
                user1: {
                    select: {
                        id: true,
                        user_name: true,
                        contents: {
                            where: { language: this.DEFAULT_LANGUAGE },
                            select: { first_name: true, last_name: true, company: true }
                        }
                    }
                },
                user2: {
                    select: {
                        id: true,
                        user_name: true,
                        contents: {
                            where: { language: this.DEFAULT_LANGUAGE },
                            select: { first_name: true, last_name: true, company: true }
                        }
                    }
                },
                buyAd: {
                    include: {
                        contents: {
                            where: { language: this.DEFAULT_LANGUAGE },
                            select: { name: true }
                        }
                    }
                },
                _count: {
                    select: {
                        messages: true
                    }
                },
                messages: {
                    take: 1,
                    orderBy: { created_at: 'desc' },
                    select: {
                        content: true,
                        created_at: true
                    }
                }
            },
            orderBy: { updated_at: 'desc' }
        });

        const userConversations = conversations.map(conversation => {
            const otherUser = conversation.user1_id === userId ? conversation.user2 : conversation.user1;

            return {
                id: conversation.id,
                created_at: conversation.created_at,
                updated_at: conversation.updated_at,
                other_user: {
                    id: otherUser.id,
                    name: `${otherUser.contents[0]?.first_name || ''} ${otherUser.contents[0]?.last_name || ''}`.trim() || otherUser.user_name,
                    company: otherUser.contents[0]?.company
                },
                buy_ad: conversation.buyAd ? {
                    id: conversation.buyAd.id,
                    name: conversation.buyAd.contents[0]?.name
                } : null,
                message_count: conversation._count.messages,
                last_message: conversation.messages[0]?.content,
                last_message_time: conversation.messages[0]?.created_at
            };
        });

        // آمار کلی کاربر
        const userStats = await this.prisma.message.aggregate({
            where: {
                sender_id: userId,
                created_at: { gte: startDate }
            },
            _count: { id: true },
            _min: { created_at: true },
            _max: { created_at: true }
        });

        return {
            user: {
                id: user.id,
                name: `${user.contents[0]?.first_name || ''} ${user.contents[0]?.last_name || ''}`.trim() || user.user_name,
                company: user.contents[0]?.company,
                user_name: user.user_name
            },
            statistics: {
                total_conversations: conversations.length,
                total_messages: userStats._count.id,
                first_message_date: userStats._min.created_at,
                last_message_date: userStats._max.created_at
            },
            conversations: userConversations
        };
    }

// ۴. دریافت چت‌های فعال (اخیراً به‌روز شده)
    async getActiveConversations(hours: number = 24, page: number = 1, limit: number = 20) {
        const skip = (page - 1) * limit;
        const cutoffDate = new Date();
        cutoffDate.setHours(cutoffDate.getHours() - hours);

        const [conversations, total] = await Promise.all([
            this.prisma.conversation.findMany({
                where: {
                    updated_at: { gte: cutoffDate }
                },
                include: {
                    user1: {
                        select: {
                            id: true,
                            user_name: true,
                            contents: {
                                where: { language: this.DEFAULT_LANGUAGE },
                                select: { first_name: true, last_name: true, company: true }
                            }
                        }
                    },
                    user2: {
                        select: {
                            id: true,
                            user_name: true,
                            contents: {
                                where: { language: this.DEFAULT_LANGUAGE },
                                select: { first_name: true, last_name: true, company: true }
                            }
                        }
                    },
                    buyAd: {
                        include: {
                            contents: {
                                where: { language: this.DEFAULT_LANGUAGE },
                                select: { name: true }
                            }
                        }
                    },
                    _count: {
                        select: {
                            messages: {
                                where: {
                                    created_at: { gte: cutoffDate }
                                }
                            }
                        }
                    }
                },
                orderBy: { updated_at: 'desc' },
                skip,
                take: limit
            }),
            this.prisma.conversation.count({
                where: {
                    updated_at: { gte: cutoffDate }
                }
            })
        ]);

        const processedConversations = conversations.map(conversation => ({
            id: conversation.id,
            updated_at: conversation.updated_at,
            last_message_text: conversation.last_message_text,
            participants: {
                user1: {
                    id: conversation.user1.id,
                    name: `${conversation.user1.contents[0]?.first_name || ''} ${conversation.user1.contents[0]?.last_name || ''}`.trim() || conversation.user1.user_name,
                    company: conversation.user1.contents[0]?.company
                },
                user2: {
                    id: conversation.user2.id,
                    name: `${conversation.user2.contents[0]?.first_name || ''} ${conversation.user2.contents[0]?.last_name || ''}`.trim() || conversation.user2.user_name,
                    company: conversation.user2.contents[0]?.company
                }
            },
            buy_ad: conversation.buyAd ? {
                id: conversation.buyAd.id,
                name: conversation.buyAd.contents[0]?.name
            } : null,
            recent_message_count: conversation._count.messages
        }));

        return {
            data: processedConversations,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                active_hours: hours
            }
        };
    }

// ۵. آنالیز موضوعات داغ در چت‌ها
    async getChatTrendsAnalysis(days: number = 7) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // نمونه‌ای از تحلیل کلمات کلیدی (در نسخه واقعی از NLP استفاده می‌شود)
        const recentMessages = await this.prisma.message.findMany({
            where: {
                created_at: { gte: startDate }
            },
            select: {
                content: true,
                created_at: true,
                conversation: {
                    include: {
                        buyAd: {
                            include: {
                                contents: {
                                    where: { language: this.DEFAULT_LANGUAGE },
                                    select: { name: true }
                                }
                            }
                        }
                    }
                }
            },
            take: 1000 // محدودیت برای نمونه‌گیری
        });

        // تحلیل ساده کلمات کلیدی
        const keywordAnalysis = this.analyzeKeywords(recentMessages);

        // دسته‌بندی چت‌ها بر اساس نوع
        const categoryAnalysis = this.categorizeConversations(recentMessages);

        return {
            period_days: days,
            total_messages_analyzed: recentMessages.length,
            trending_keywords: keywordAnalysis,
            conversation_categories: categoryAnalysis,
            recommendations: this.generateRecommendations(keywordAnalysis, categoryAnalysis)
        };
    }

// متدهای کمکی برای تحلیل
    private analyzeKeywords(messages: any[]) {
        const commonWords = new Set(['سلام', 'با', 'در', 'که', 'این', 'را', 'برای', 'است', 'باشد', 'شد']);
        const wordFrequency: { [key: string]: number } = {};

        messages.forEach(message => {
            const words = message.content.split(/\s+/);
            words.forEach(word => {
                const cleanWord = word.replace(/[.,!?;:()]/g, '').toLowerCase();
                if (cleanWord.length > 2 && !commonWords.has(cleanWord)) {
                    wordFrequency[cleanWord] = (wordFrequency[cleanWord] || 0) + 1;
                }
            });
        });

        return Object.entries(wordFrequency)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 20)
            .map(([word, count]) => ({ word, frequency: count }));
    }

    private categorizeConversations(messages: any[]) {
        const categories = {
            price_negotiation: 0,
            product_inquiry: 0,
            delivery: 0,
            payment: 0,
            technical: 0,
            other: 0
        };

        const priceKeywords = ['قیمت', 'تومان', 'ارزان', 'گران', 'تخفیف'];
        const productKeywords = ['محصول', 'کالا', 'جنس', 'کیفیت', 'مشخصات'];
        const deliveryKeywords = ['ارسال', 'پست', 'حمل', 'تحویل', 'زمان'];
        const paymentKeywords = ['پرداخت', 'کارت', 'بانک', 'چک', 'نقد'];
        const technicalKeywords = ['فنی', 'مشکل', 'ایراد', 'گارانتی', 'خدمات'];

        messages.forEach(message => {
            const content = message.content.toLowerCase();

            if (priceKeywords.some(keyword => content.includes(keyword))) {
                categories.price_negotiation++;
            } else if (productKeywords.some(keyword => content.includes(keyword))) {
                categories.product_inquiry++;
            } else if (deliveryKeywords.some(keyword => content.includes(keyword))) {
                categories.delivery++;
            } else if (paymentKeywords.some(keyword => content.includes(keyword))) {
                categories.payment++;
            } else if (technicalKeywords.some(keyword => content.includes(keyword))) {
                categories.technical++;
            } else {
                categories.other++;
            }
        });

        return categories;
    }

    private generateRecommendations(keywordAnalysis: any[], categoryAnalysis: any) {
        const recommendations = [];

        if (categoryAnalysis.price_negotiation > categoryAnalysis.product_inquiry * 2) {
            recommendations.push('کاربران بیشتر روی قیمت متمرکز هستند. سیستم قیمت‌گذاری هوشمند می‌تواند مفید باشد.');
        }

        if (categoryAnalysis.delivery > categoryAnalysis.payment) {
            recommendations.push('مسائل حمل و نقل اولویت کاربران است. بهبود سیستم تحویل پیشنهاد می‌شود.');
        }

        // تحلیل کلمات کلیدی برای پیشنهادات محصول
        const productKeywords = keywordAnalysis
            .filter(item => this.isProductRelated(item.word))
            .slice(0, 5);

        if (productKeywords.length > 0) {
            recommendations.push(`محصولات پرطرفدار: ${productKeywords.map(p => p.word).join(', ')}`);
        }

        return recommendations;
    }

    private isProductRelated(word: string): boolean {
        const productIndicators = ['کالا', 'جنس', 'محصول', 'کالا', 'تجهیزات', 'لوازم'];
        return productIndicators.some(indicator => word.includes(indicator));
    }


    async markAsRead(messageId: string, userId: string): Promise<{ success: boolean }> {
        const result = await this.markMessagesAsRead([messageId], userId);
        return { success: result.count > 0 };
    }
}