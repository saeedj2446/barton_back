// src/comments/comments.service.ts
import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { CommentQueryDto } from './dto/comment-query.dto';
import { Language, SystemRole } from '@prisma/client';

@Injectable()
export class CommentsService {
    constructor(private prisma: PrismaService) {}

    private readonly DEFAULT_LANGUAGE = Language.fa;

    async create(createCommentDto: CreateCommentDto, userId: string, language: Language = this.DEFAULT_LANGUAGE) {
        // بررسی وجود والد
        if (createCommentDto.parent_id) {
            const parent = await this.prisma.comment.findUnique({
                where: { id: createCommentDto.parent_id }
            });
            if (!parent) throw new NotFoundException('کامنت والد یافت نشد');
        }

        // بررسی وجود محصول یا حساب
        if (createCommentDto.product_id) {
            const product = await this.prisma.product.findUnique({
                where: { id: createCommentDto.product_id }
            });
            if (!product) throw new NotFoundException('محصول یافت نشد');
        }

        if (createCommentDto.account_id) {
            const account = await this.prisma.account.findUnique({
                where: { id: createCommentDto.account_id }
            });
            if (!account) throw new NotFoundException('حساب یافت نشد');
        }

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                contents: {
                    where: { language },
                    select: { first_name: true, last_name: true }
                }
            }
        });

        return this.prisma.$transaction(async (tx) => {
            // ایجاد کامنت اصلی
            const comment = await tx.comment.create({
                data: {
                    user_id: userId,
                    product_id: createCommentDto.product_id,
                    account_id: createCommentDto.account_id,
                    parent_id: createCommentDto.parent_id,
                    confirmed: true // پیش‌فرض تأیید شده
                }
            });

            // ایجاد محتوای چندزبانه
            await tx.commentContent.create({
                data: {
                    comment_id: comment.id,
                    language: language,
                    content: createCommentDto.content,

                }
            });

            // بازگرداندن کامنت با اطلاعات کامل
            return this.getCommentWithDetails(comment.id, language);
        });
    }

    async findAll(query: CommentQueryDto & { language?: Language }) {
        const {
            page = 1,
            limit = 20,
            product_id,
            account_id,
            parent_id,
            include_replies = false,
            confirmed,
            user_id,
            language = this.DEFAULT_LANGUAGE
        } = query;

        const skip = (page - 1) * limit;

        const where: any = {};
        if (product_id) where.product_id = product_id;
        if (account_id) where.account_id = account_id;
        if (parent_id) where.parent_id = parent_id;
        else where.parent_id = null; // فقط کامنت‌های اصلی
        if (confirmed !== undefined) where.confirmed = confirmed;
        if (user_id) where.user_id = user_id;

        const [comments, total] = await Promise.all([
            this.prisma.comment.findMany({
                where,
                skip,
                take: limit,
                include: this.getCommentInclude(language, include_replies),
                orderBy: { created_at: 'desc' }
            }),
            this.prisma.comment.count({ where })
        ]);

        return {
            data: comments,
            meta: { page, limit, total, totalPages: Math.ceil(total / limit) }
        };
    }

    async findOne(id: string, language: Language = this.DEFAULT_LANGUAGE) {
        const comment = await this.getCommentWithDetails(id, language);
        if (!comment) throw new NotFoundException('کامنت یافت نشد');
        return comment;
    }

    async update(id: string, updateCommentDto: UpdateCommentDto, userId: string, language: Language = this.DEFAULT_LANGUAGE) {
        const comment = await this.prisma.comment.findUnique({
            where: { id },
            include: { contents: { where: { language } } }
        });

        if (!comment) {
            throw new NotFoundException('کامنت یافت نشد');
        }

        // فقط صاحب کامنت یا ادمین می‌تواند ویرایش کند
        if (userId && comment.user_id !== userId) {
            throw new ForbiddenException('شما اجازه ویرایش این کامنت را ندارید');
        }

        return this.prisma.$transaction(async (tx) => {
            // آپدیت فیلدهای اصلی
            const updateData: any = {};
            if (updateCommentDto.confirmed !== undefined) {
                updateData.confirmed = updateCommentDto.confirmed;
            }

            const updatedComment = await tx.comment.update({
                where: { id },
                data: updateData
            });

            // آپدیت محتوای چندزبانه اگر content ارائه شده باشد
            if (updateCommentDto.content) {
                const existingContent = comment.contents[0];
                if (existingContent) {
                    await tx.commentContent.update({
                        where: { id: existingContent.id },
                        data: { content: updateCommentDto.content }
                    });
                } else {
                    await tx.commentContent.create({
                        data: {
                            comment_id: id,
                            language: language,
                            content: updateCommentDto.content
                        }
                    });
                }
            }

            return this.getCommentWithDetails(id, language);
        });
    }

    async remove(id: string, userId: string) {
        const comment = await this.prisma.comment.findUnique({ where: { id } });

        if (!comment) {
            throw new NotFoundException('کامنت یافت نشد');
        }

        // فقط صاحب کامنت یا ادمین می‌تواند حذف کند
        if (userId && comment.user_id !== userId) {
            throw new ForbiddenException('شما اجازه حذف این کامنت را ندارید');
        }

        // حذف پاسخ‌ها به صورت cascade
        await this.prisma.comment.deleteMany({ where: { parent_id: id } });
        await this.prisma.comment.delete({ where: { id } });

        return { message: 'کامنت و پاسخ‌های آن با موفقیت حذف شد' };
    }

    async likeComment(id: string, userId: string) {
        const comment = await this.prisma.comment.findUnique({ where: { id } });

        if (!comment) {
            throw new NotFoundException('کامنت یافت نشد');
        }

        // بررسی اینکه کاربر قبلاً لایک کرده یا نه
        if (comment.already_liked) {
            throw new ConflictException('شما قبلاً این کامنت را لایک کرده‌اید');
        }

        return this.prisma.comment.update({
            where: { id },
            data: {
                likes: { increment: 1 },
                already_liked: true
            }
        });
    }

    // ==================== متدهای مدیریتی ====================

    async confirmComment(id: string, adminId: string, language: Language = this.DEFAULT_LANGUAGE) {
        const comment = await this.prisma.comment.findUnique({ where: { id } });

        if (!comment) {
            throw new NotFoundException('کامنت یافت نشد');
        }

        const confirmedComment = await this.prisma.comment.update({
            where: { id },
            data: { confirmed: true }
        });

        return this.getCommentWithDetails(id, language);
    }

    async getCommentStats(timeframe: string = '30d') {
        const dateFilter = this.buildDateFilter(timeframe);

        const [totalComments, totalReplies, pendingComments] = await Promise.all([
            this.prisma.comment.count({
                where: {
                    parent_id: null,
                    created_at: dateFilter
                }
            }),
            this.prisma.comment.count({
                where: {
                    parent_id: { not: null },
                    created_at: dateFilter
                }
            }),
            this.prisma.comment.count({
                where: {
                    confirmed: false,
                    created_at: dateFilter
                }
            })
        ]);

        return {
            totalComments,
            totalReplies,
            pendingComments,
            total: totalComments + totalReplies
        };
    }

    // ==================== متدهای کمکی ====================

    private async getCommentWithDetails(id: string, language: Language) {
        return this.prisma.comment.findUnique({
            where: { id },
            include: this.getCommentInclude(language, true)
        });
    }

    private getCommentInclude(language: Language, includeReplies: boolean = false) {
        const baseInclude: any = {
            contents: {
                where: { language },
                select: { content: true, first_name: true, last_name: true }
            },
            product: {
                select: {
                    id: true,
                    base_name: true,
                    contents: {
                        where: { language },
                        select: { name: true }
                    }
                }
            },
            account: {
                select: {
                    id: true,
                    name: true,
                    contents: {
                        where: { language },
                        select: { name: true }
                    }
                }
            },
            user: {
                select: {
                    id: true,
                    user_name: true,
                    contents: {
                        where: { language },
                        select: { first_name: true, last_name: true }
                    }
                }
            }
        };

        if (includeReplies) {
            baseInclude.replies = {
                include: {
                    contents: {
                        where: { language },
                        select: { content: true, first_name: true, last_name: true }
                    },
                    user: {
                        select: {
                            id: true,
                            user_name: true,
                            contents: {
                                where: { language },
                                select: { first_name: true, last_name: true }
                            }
                        }
                    }
                },
                orderBy: { created_at: 'asc' }
            };
        }

        return baseInclude;
    }

    private buildDateFilter(timeframe: string): any {
        const now = new Date();
        let startDate: Date;

        switch (timeframe) {
            case '7d':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case '30d':
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            case '90d':
                startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                break;
            case '1y':
                startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
                break;
            default:
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }

        return { gte: startDate };
    }
}