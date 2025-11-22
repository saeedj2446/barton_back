// src/reviews/reviews.service.ts
import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { ReviewQueryDto } from './dto/review-query.dto';
import { Language, SystemRole } from '@prisma/client';

@Injectable()
export class ReviewsService {
    constructor(private prisma: PrismaService) {}

    private readonly DEFAULT_LANGUAGE = Language.fa;

    async create(createReviewDto: CreateReviewDto, userId: string, language: Language = this.DEFAULT_LANGUAGE) {
        // بررسی وجود محصول یا حساب
        if (createReviewDto.product_id) {
            const product = await this.prisma.product.findUnique({
                where: { id: createReviewDto.product_id }
            });
            if (!product) throw new NotFoundException('محصول یافت نشد');
        }

        if (createReviewDto.account_id) {
            const account = await this.prisma.account.findUnique({
                where: { id: createReviewDto.account_id }
            });
            if (!account) throw new NotFoundException('حساب یافت نشد');
        }

        // بررسی نظرات تکراری
        const existingReview = await this.prisma.review.findFirst({
            where: {
                user_id: userId,
                OR: [
                    { product_id: createReviewDto.product_id },
                    { account_id: createReviewDto.account_id }
                ]
            }
        });

        if (existingReview) {
            throw new ConflictException('شما قبلاً برای این محصول/حساب نظر داده‌اید');
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
            // ایجاد نظر اصلی
            const review = await tx.review.create({
                data: {
                    user_id: userId,
                    product_id: createReviewDto.product_id,
                    account_id: createReviewDto.account_id,
                    rating_score: createReviewDto.rating_score,
                    confirmed: false // پیش‌فرض تأیید نشده
                }
            });

            // ایجاد محتوای چندزبانه
            await tx.reviewContent.create({
                data: {
                    review_id: review.id,
                    language: language,
                    comment: createReviewDto.comment,

                }
            });

            // بازگرداندن نظر با اطلاعات کامل
            return this.getReviewWithDetails(review.id, language);
        });
    }

    async findAll(query: ReviewQueryDto & { language?: Language }) {
        const {
            page = 1,
            limit = 20,
            product_id,
            account_id,
            user_id,
            min_rating,
            confirmed,
            language = this.DEFAULT_LANGUAGE
        } = query;

        const skip = (page - 1) * limit;

        const where: any = {};
        if (product_id) where.product_id = product_id;
        if (account_id) where.account_id = account_id;
        if (user_id) where.user_id = user_id;
        if (min_rating) where.rating_score = { gte: min_rating };
        if (confirmed !== undefined) where.confirmed = confirmed;

        const [reviews, total] = await Promise.all([
            this.prisma.review.findMany({
                where,
                skip,
                take: limit,
                include: this.getReviewInclude(language),
                orderBy: { created_at: 'desc' }
            }),
            this.prisma.review.count({ where })
        ]);

        return {
            data: reviews,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                averageRating: await this.calculateAverageRating(where)
            }
        };
    }

    async findOne(id: string, language: Language = this.DEFAULT_LANGUAGE) {
        const review = await this.getReviewWithDetails(id, language);
        if (!review) throw new NotFoundException('نظر یافت نشد');
        return review;
    }

    async update(id: string, updateReviewDto: UpdateReviewDto, userId: string, language: Language = this.DEFAULT_LANGUAGE) {
        const review = await this.prisma.review.findUnique({
            where: { id },
            include: { contents: { where: { language } } }
        });

        if (!review) {
            throw new NotFoundException('نظر یافت نشد');
        }

        // فقط صاحب نظر یا ادمین می‌تواند ویرایش کند
        if (review.user_id !== userId) {
            throw new ForbiddenException('شما اجازه ویرایش این نظر را ندارید');
        }

        return this.prisma.$transaction(async (tx) => {
            // آپدیت فیلدهای اصلی
            const updatedReview = await tx.review.update({
                where: { id },
                data: {
                    rating_score: updateReviewDto.rating_score,
                    confirmed: false // پس از ویرایش، نظر نیاز به تأیید مجدد دارد
                }
            });

            // آپدیت یا ایجاد محتوای چندزبانه
            const existingContent = review.contents[0];
            if (existingContent) {
                await tx.reviewContent.update({
                    where: { id: existingContent.id },
                    data: {
                        comment: updateReviewDto.comment
                    }
                });
            } else {
                await tx.reviewContent.create({
                    data: {
                        review_id: id,
                        language: language,
                        comment: updateReviewDto.comment
                    }
                });
            }

            return this.getReviewWithDetails(id, language);
        });
    }

    async remove(id: string, userId: string) {
        const review = await this.prisma.review.findUnique({ where: { id } });

        if (!review) {
            throw new NotFoundException('نظر یافت نشد');
        }

        // فقط صاحب نظر یا ادمین می‌تواند حذف کند
        if (review.user_id !== userId) {
            throw new ForbiddenException('شما اجازه حذف این نظر را ندارید');
        }

        await this.prisma.review.delete({ where: { id } });
        return { message: 'نظر با موفقیت حذف شد' };
    }

    async likeReview(id: string, userId: string) {
        const review = await this.prisma.review.findUnique({ where: { id } });

        if (!review) {
            throw new NotFoundException('نظر یافت نشد');
        }

        // بررسی اینکه کاربر قبلاً لایک کرده یا نه
        if (review.already_liked) {
            throw new ConflictException('شما قبلاً این نظر را لایک کرده‌اید');
        }

        return this.prisma.review.update({
            where: { id },
            data: {
                likes: { increment: 1 },
                already_liked: true
            }
        });
    }

    // ==================== متدهای مدیریتی ====================

    async confirmReview(id: string, adminId: string, language: Language = this.DEFAULT_LANGUAGE) {
        const review = await this.prisma.review.findUnique({ where: { id } });

        if (!review) {
            throw new NotFoundException('نظر یافت نشد');
        }

        const confirmedReview = await this.prisma.review.update({
            where: { id },
            data: { confirmed: true }
        });

        return this.getReviewWithDetails(id, language);
    }

    async getReviewStats(timeframe: string = '30d') {
        const dateFilter = this.buildDateFilter(timeframe);

        const [total, pending, approved, averageRating] = await Promise.all([
            this.prisma.review.count({ where: { created_at: dateFilter } }),
            this.prisma.review.count({
                where: {
                    created_at: dateFilter,
                    confirmed: false
                }
            }),
            this.prisma.review.count({
                where: {
                    created_at: dateFilter,
                    confirmed: true
                }
            }),
            this.calculateAverageRating({ created_at: dateFilter })
        ]);

        return {
            total,
            pending,
            approved,
            averageRating,
            approvalRate: total > 0 ? (approved / total) * 100 : 0
        };
    }

    // ==================== متدهای کمکی ====================

    private async getReviewWithDetails(id: string, language: Language) {
        return this.prisma.review.findUnique({
            where: { id },
            include: this.getReviewInclude(language)
        });
    }

    private getReviewInclude(language: Language) {
        return {
            contents: {
                where: { language },
                select: { comment: true, first_name: true, last_name: true }
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
    }

    private async calculateAverageRating(where: any): Promise<number> {
        const result = await this.prisma.review.aggregate({
            where,
            _avg: { rating_score: true }
        });
        return result._avg.rating_score || 0;
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