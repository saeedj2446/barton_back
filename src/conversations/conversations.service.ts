// src/conversations/conversations.service.ts
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { ConversationQueryDto } from './dto/conversation-query.dto';
import { FileUsage, Prisma, Language } from '@prisma/client';

@Injectable()
export class ConversationsService {
    constructor(private prisma: PrismaService) {}

    private readonly DEFAULT_LANGUAGE = Language.fa;

    // متد کمکی برای includeهای مشترک با فیلدهای صحیح
    private getConversationInclude(language: Language = this.DEFAULT_LANGUAGE): Prisma.ConversationInclude {
        return {
            user1: {
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
            user2: {
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
            messages: {
                take: 1,
                orderBy: {
                    created_at: 'desc'
                },
                include: {
                    sender: {
                        select: {
                            user_name: true,
                            contents: {
                                where: { language },
                                select: { first_name: true, last_name: true }
                            }
                        }
                    }
                }
            },
            _count: {
                select: {
                    messages: {
                        where: {
                            is_read: false
                        }
                    }
                }
            }
        };
    }

    // ایجاد مکالمه جدید
    async createConversation(
        createConversationDto: CreateConversationDto,
        userId: string,
        language: Language = this.DEFAULT_LANGUAGE
    ) {
        const { user2_id, buy_ad_id, initial_message } = createConversationDto;

        // بررسی وجود کاربر مقابل
        const otherUser = await this.prisma.user.findUnique({
            where: { id: user2_id }
        });

        if (!otherUser) {
            throw new NotFoundException('کاربر مورد نظر یافت نشد');
        }

        // بررسی وجود مکالمه قبلی
        const existingConversation = await this.prisma.conversation.findFirst({
            where: {
                OR: [
                    { user1_id: userId, user2_id: user2_id },
                    { user1_id: user2_id, user2_id: userId }
                ]
            },
            include: this.getConversationInclude(language)
        });

        if (existingConversation) {
            return this.enrichConversation(existingConversation, userId, language);
        }

        // ایجاد مکالمه جدید
        return await this.prisma.$transaction(async (tx) => {
            const conversationData: Prisma.ConversationCreateInput = {
                user1: { connect: { id: userId } },
                user2: { connect: { id: user2_id } },
            };

            // اگر buy_ad_id وجود دارد، آن را اضافه کن
            if (buy_ad_id) {
                // بررسی وجود آگهی خرید
                const buyAd = await tx.buyAd.findUnique({
                    where: { id: buy_ad_id }
                });

                if (!buyAd) {
                    throw new NotFoundException('آگهی خرید مورد نظر یافت نشد');
                }

                conversationData.buyAd = { connect: { id: buy_ad_id } };
            }

            const conversation = await tx.conversation.create({
                data: conversationData,
                include: this.getConversationInclude(language)
            });

            // اگر پیام اولیه وجود دارد
            if (initial_message && initial_message.trim()) {
                const receiverId = conversation.user1_id === userId ? conversation.user2_id : conversation.user1_id;

                await tx.message.create({
                    data: {
                        content: initial_message,
                        sender: { connect: { id: userId } },
                        receiver: { connect: { id: receiverId } },
                        conversation: { connect: { id: conversation.id } },
                        message_type: 'USER_TO_USER'
                    }
                });

                // آپدیت last message
                await tx.conversation.update({
                    where: { id: conversation.id },
                    data: {
                        last_message_text: initial_message.substring(0, 100),
                        last_message_time: new Date(),
                        updated_at: new Date()
                    }
                });
            }

            return this.enrichConversation(conversation, userId, language);
        });
    }

// متد enrichConversation (به جای processConversationResult)
    private enrichConversation(conversation: any, currentUserId: string, language: Language) {
        const isUser1 = conversation.user1_id === currentUserId;
        const otherUser = isUser1 ? conversation.user2 : conversation.user1;
        const otherUserContent = otherUser.contents?.[0];

        return {
            id: conversation.id,
            created_at: conversation.created_at,
            updated_at: conversation.updated_at,
            last_message_text: conversation.last_message_text,
            last_message_time: conversation.last_message_time,

            // اطلاعات کاربر مقابل
            other_user: {
                id: otherUser.id,
                user_name: otherUser.user_name,
                is_verified: otherUser.is_verified,
                first_name: otherUserContent?.first_name,
                last_name: otherUserContent?.last_name,
                full_name: `${otherUserContent?.first_name || ''} ${otherUserContent?.last_name || ''}`.trim()
            },

            // اطلاعات آگهی خرید
            buy_ad: conversation.buyAd ? {
                id: conversation.buyAd.id,
                name: conversation.buyAd.contents?.[0]?.name
            } : null,

            // آخرین پیام‌ها
            recent_messages: (conversation.messages || []).map((msg: any) => ({
                id: msg.id,
                content: msg.content,
                created_at: msg.created_at,
                is_sent_by_me: msg.sender_id === currentUserId,
                sender: {
                    user_name: msg.sender.user_name,
                    first_name: msg.sender.contents?.[0]?.first_name,
                    last_name: msg.sender.contents?.[0]?.last_name
                }
            })).reverse(),

            unread_count: 0,
            total_messages: conversation._count?.messages || 0
        };
    }

    // دریافت مکالمات کاربر
    async getUserConversations(userId: string, query: ConversationQueryDto & { language?: Language }) {
        const { page = 1, limit = 20, unread_only = false, language = this.DEFAULT_LANGUAGE } = query;
        const skip = (page - 1) * limit;

        const where: Prisma.ConversationWhereInput = {
            OR: [
                { user1_id: userId },
                { user2_id: userId }
            ]
        };

        // اگر فقط مکالمات دارای پیام نخوانده requested شود
        if (unread_only) {
            where.messages = {
                some: {
                    is_read: false,
                    sender_id: { not: userId }
                }
            };
        }

        const [conversations, total] = await Promise.all([
            this.prisma.conversation.findMany({
                where,
                include: this.getConversationInclude(language),
                orderBy: { updated_at: 'desc' },
                skip,
                take: limit
            }),
            this.prisma.conversation.count({ where })
        ]);

        // پردازش نتایج
        const processedConversations = await Promise.all(
            conversations.map(conversation =>
                this.processConversationResult(conversation, userId, language)
            )
        );

        return {
            data: processedConversations,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                unread_conversations_count: unread_only ? total : await this.getUnreadConversationsCount(userId)
            }
        };
    }

    // دریافت یک مکالمه خاص
    async getConversation(id: string, userId: string, language: Language = this.DEFAULT_LANGUAGE) {
        const conversation = await this.prisma.conversation.findUnique({
            where: { id },
            include: {
                user1: {
                    select: {
                        id: true,
                        user_name: true,
                        is_verified: true,
                        mobile: true,
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
                user2: {
                    select: {
                        id: true,
                        user_name: true,
                        is_verified: true,
                        mobile: true,
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
                messages: {
                    take: 10,
                    orderBy: { created_at: 'desc' },
                    include: {
                        sender: {
                            select: {
                                id: true,
                                user_name: true,
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
                        }
                    }
                }
            }
        });

        if (!conversation) {
            throw new NotFoundException('مکالمه یافت نشد');
        }

        // بررسی دسترسی کاربر به مکالمه
        if (conversation.user1_id !== userId && conversation.user2_id !== userId) {
            throw new ForbiddenException('دسترسی به این مکالمه ندارید');
        }

        // اگر buy_ad_id وجود دارد، اطلاعات آگهی را بگیر
        let buyAdInfo = null;
        if (conversation.buy_ad_id) {
            buyAdInfo = await this.prisma.buyAd.findUnique({
                where: { id: conversation.buy_ad_id },
                select: {
                    id: true,
                    contents: {
                        where: { language },
                        select: { name: true }
                    },
                    requirement_amount: true,
                    unit: true
                }
            });
        }

        return this.processConversationResult({
            ...conversation,
            buyAd: buyAdInfo
        }, userId, language);
    }

    // پردازش نتیجه مکالمه
    private async processConversationResult(conversation: any, userId: string, language: Language) {
        const otherUser = conversation.user1_id === userId ? conversation.user2 : conversation.user1;
        const unreadCount = conversation._count?.messages || 0;
        const profilePhoto = otherUser.files?.[0] || null;

        // استخراج نام از محتوای چندزبانه
        const userContent = otherUser.contents?.[0];
        const firstName = userContent?.first_name;
        const lastName = userContent?.last_name;

        // اگر buy_ad_id وجود دارد اما buyAd نیست، اطلاعات را بگیر
        let buyAdInfo = conversation.buyAd;
        if (conversation.buy_ad_id && !buyAdInfo) {
            buyAdInfo = await this.prisma.buyAd.findUnique({
                where: { id: conversation.buy_ad_id },
                select: {
                    id: true,
                    contents: {
                        where: { language },
                        select: { name: true }
                    }
                }
            });
        }

        return {
            // حفظ فیلدهای اصلی مکالمه
            id: conversation.id,
            created_at: conversation.created_at,
            updated_at: conversation.updated_at,
            user1_id: conversation.user1_id,
            user2_id: conversation.user2_id,
            last_message_text: conversation.last_message_text,
            last_message_time: conversation.last_message_time,
            user1_last_read_at: conversation.user1_last_read_at,
            user2_last_read_at: conversation.user2_last_read_at,
            buy_ad_id: conversation.buy_ad_id,

            // اطلاعات پردازش شده
            other_user: {
                id: otherUser.id,
                user_name: otherUser.user_name,
                first_name: firstName,
                last_name: lastName,
                full_name: [firstName, lastName].filter(Boolean).join(' ') || otherUser.user_name,
                is_verified: otherUser.is_verified,
                mobile: otherUser.mobile,
                profile_photo: profilePhoto
            },
            unread_count: unreadCount,
            last_message: conversation.messages?.[0] || null,
            buy_ad: buyAdInfo,
            is_other_user_online: false,

            // اطلاعات کاربران برای دسترسی آسان
            user1: conversation.user1,
            user2: conversation.user2,
            messages: conversation.messages
        };
    }

    // بقیه متدها...
    async deleteConversation(id: string, userId: string) {
        const conversation = await this.getConversation(id, userId, this.DEFAULT_LANGUAGE);

        await this.prisma.conversation.delete({
            where: { id }
        });

        return { message: 'مکالمه با موفقیت حذف شد' };
    }

    async markConversationAsRead(conversationId: string, userId: string) {
        const conversation = await this.getConversation(conversationId, userId, this.DEFAULT_LANGUAGE);

        await this.prisma.message.updateMany({
            where: {
                conversation_id: conversationId,
                sender_id: { not: userId },
                is_read: false
            },
            data: { is_read: true }
        });

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

        return { message: 'تمام پیام‌ها خوانده شدند' };
    }

    async checkConversationPossibility(userId: string, otherUserId: string, language: Language = this.DEFAULT_LANGUAGE) {
        const otherUser = await this.prisma.user.findUnique({
            where: { id: otherUserId },
            select: {
                id: true,
                user_name: true,
                is_verified: true,
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
        });

        if (!otherUser) {
            throw new NotFoundException('کاربر مورد نظر یافت نشد');
        }

        if (otherUser.is_blocked) {
            return {
                can_create: false,
                reason: 'کاربر مسدود شده است',
                other_user: otherUser
            };
        }

        const existingConversation = await this.prisma.conversation.findFirst({
            where: {
                OR: [
                    { user1_id: userId, user2_id: otherUserId },
                    { user1_id: otherUserId, user2_id: userId }
                ]
            },
            select: { id: true }
        });

        return {
            can_create: true,
            existing_conversation_id: existingConversation?.id || null,
            other_user: otherUser,
            reason: existingConversation ? 'مکالمه از قبل وجود دارد' : 'امکان ایجاد مکالمه جدید'
        };
    }

    private async getUnreadConversationsCount(userId: string): Promise<number> {
        return this.prisma.conversation.count({
            where: {
                OR: [
                    { user1_id: userId },
                    { user2_id: userId }
                ],
                messages: {
                    some: {
                        is_read: false,
                        sender_id: { not: userId }
                    }
                }
            }
        });
    }
}