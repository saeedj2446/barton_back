// src/interactions/interactions.service.ts
import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInteractionDto } from './dto/create-interaction.dto';
import { InteractionQueryDto } from './dto/interaction-query.dto';
import { Language, InteractionType } from '@prisma/client';

@Injectable()
export class InteractionsService {
    constructor(private prisma: PrismaService) {}

    private readonly DEFAULT_LANGUAGE = Language.fa;

    async create(createInteractionDto: CreateInteractionDto, userId: string, language: Language = this.DEFAULT_LANGUAGE) {
        // بررسی وجود محصول یا حساب
        if (createInteractionDto.product_id) {
            const product = await this.prisma.product.findUnique({
                where: { id: createInteractionDto.product_id }
            });
            if (!product) throw new NotFoundException('محصول یافت نشد');
        }

        if (createInteractionDto.account_id) {
            const account = await this.prisma.account.findUnique({
                where: { id: createInteractionDto.account_id }
            });
            if (!account) throw new NotFoundException('حساب یافت نشد');
        }

        // بررسی تعامل تکراری (به جز VIEW)
        if (createInteractionDto.type !== InteractionType.VIEW) {
            const existingInteraction = await this.prisma.interaction.findFirst({
                where: {
                    user_id: userId,
                    product_id: createInteractionDto.product_id,
                    account_id: createInteractionDto.account_id,
                    type: createInteractionDto.type
                }
            });

            if (existingInteraction) {
                throw new ConflictException('شما قبلاً این تعامل را انجام داده‌اید');
            }
        }

        return this.prisma.interaction.create({
            data: {
                ...createInteractionDto,
                user_id: userId
            },
            include: this.getInteractionInclude(language)
        });
    }

    async findAll(query: InteractionQueryDto & { language?: Language }) {
        const {
            page = 1,
            limit = 20,
            product_id,
            account_id,
            user_id,
            type,
            language = this.DEFAULT_LANGUAGE
        } = query;

        const skip = (page - 1) * limit;

        const where: any = {};
        if (product_id) where.product_id = product_id;
        if (account_id) where.account_id = account_id;
        if (user_id) where.user_id = user_id;
        if (type) where.type = type;

        const [interactions, total] = await Promise.all([
            this.prisma.interaction.findMany({
                where,
                skip,
                take: limit,
                include: this.getInteractionInclude(language),
                orderBy: { created_at: 'desc' }
            }),
            this.prisma.interaction.count({ where })
        ]);

        // آمار کلی
        const stats = await this.prisma.interaction.groupBy({
            by: ['type'],
            where: { ...where, product_id, account_id },
            _count: true
        });

        return {
            data: interactions,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                stats
            }
        };
    }

    async remove(id: string, userId: string) {
        const interaction = await this.prisma.interaction.findUnique({
            where: { id }
        });

        if (!interaction) throw new NotFoundException('تعامل یافت نشد');
        if (userId && interaction.user_id !== userId) {
            throw new ForbiddenException('شما اجازه حذف این تعامل را ندارید');
        }

        await this.prisma.interaction.delete({ where: { id } });
        return { message: 'تعامل با موفقیت حذف شد' };
    }

    async getUserInteractions(userId: string, type?: InteractionType, language: Language = this.DEFAULT_LANGUAGE) {
        const where: any = { user_id: userId };
        if (type) where.type = type;

        return this.prisma.interaction.findMany({
            where,
            include: {
                product: {
                    select: {
                        id: true,
                        contents: {
                            where: { language },
                            select: { name: true }
                        },
                        base_min_price: true,
                        files: {
                            where: { file_usage: 'PRODUCT_IMAGE' },
                            take: 1
                        }
                    }
                },
                account: {
                    select: {
                        id: true,
                        profile_photo: true,
                        activity_type: true,
                        contents: {
                            where: { language },
                            select: {
                                name: true,
                                company_name: true
                            }
                        }
                    }
                }
            },
            orderBy: { created_at: 'desc' }
        });
    }

    // متدهای عمومی
    async getPublicStats(productId?: string, accountId?: string, language: Language = this.DEFAULT_LANGUAGE) {
        const where: any = {};

        if (productId) where.product_id = productId;
        if (accountId) where.account_id = accountId;

        // فقط انواع عمومی که نیاز به نمایش دارند
        where.type = { in: [InteractionType.LIKE, InteractionType.SAVE, InteractionType.VIEW] };

        const stats = await this.prisma.interaction.groupBy({
            by: ['type'],
            where,
            _count: true
        });

        return {
            productId,
            accountId,
            stats,
            totalLikes: stats.find(s => s.type === InteractionType.LIKE)?._count || 0,
            totalSaves: stats.find(s => s.type === InteractionType.SAVE)?._count || 0,
            totalViews: stats.find(s => s.type === InteractionType.VIEW)?._count || 0,
            total: stats.reduce((sum, stat) => sum + stat._count, 0),
            engagementRate: this.calculateEngagementRate(stats)
        };
    }

    private calculateEngagementRate(stats: any[]): number {
        const likes = stats.find(s => s.type === InteractionType.LIKE)?._count || 0;
        const saves = stats.find(s => s.type === InteractionType.SAVE)?._count || 0;
        const views = stats.find(s => s.type === InteractionType.VIEW)?._count || 0;

        if (views === 0) return 0;
        return ((likes + saves) / views) * 100;
    }

    async getPopularProducts(limit: number = 10, language: Language = this.DEFAULT_LANGUAGE) {
        const popularProducts = await this.prisma.interaction.groupBy({
            by: ['product_id'],
            where: {
                product_id: { not: null },
                type: { in: [InteractionType.LIKE, InteractionType.SAVE] }
            },
            _count: { _all: true },
            orderBy: { _count: { product_id: 'desc' } },
            take: limit
        });

        const productIds = popularProducts.map(p => p.product_id);
        const products = await this.prisma.product.findMany({
            where: { id: { in: productIds } },
            select: {
                id: true,
                contents: {
                    where: { language },
                    select: { name: true }
                },
                base_min_price: true,
                total_views: true,
                total_likes: true,
                category: {
                    select: {
                        id: true,
                        contents: {
                            where: { language },
                            select: { name: true }
                        }
                    }
                },
                files: {
                    where: { file_usage: 'PRODUCT_IMAGE' },
                    take: 1
                },
                account: {
                    select: {
                        id: true,
                        profile_photo: true,
                        activity_type: true,
                        contents: {
                            where: { language },
                            select: {
                                name: true,
                                company_name: true
                            }
                        }
                    }
                }
            }
        });

        return popularProducts.map(popular => {
            const product = products.find(p => p.id === popular.product_id);
            const productContent = product?.contents?.[0];
            const accountContent = product?.account?.contents?.[0];

            return {
                product: {
                    ...product,
                    name: productContent?.name,
                    account: product?.account ? {
                        ...product.account,
                        name: accountContent?.name || accountContent?.company_name
                    } : null
                },
                interactionCount: popular._count,
                rank: popularProducts.indexOf(popular) + 1,
                display_price: product?.base_min_price || 0
            };
        });
    }

    async getTrendingProducts(days: number = 7, limit: number = 10, language: Language = this.DEFAULT_LANGUAGE) {
        const sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - days);

        const trendingProducts = await this.prisma.interaction.groupBy({
            by: ['product_id'],
            where: {
                product_id: { not: null },
                type: InteractionType.VIEW,
                created_at: { gte: sinceDate }
            },
            _count: { _all: true },
            orderBy: { _count: { product_id: 'desc' } },
            take: limit
        });

        const productIds = trendingProducts.map(p => p.product_id);
        const products = await this.prisma.product.findMany({
            where: { id: { in: productIds } },
            select: {
                id: true,
                contents: {
                    where: { language },
                    select: { name: true }
                },
                base_min_price: true,
                category: {
                    select: {
                        id: true,
                        contents: {
                            where: { language },
                            select: { name: true }
                        }
                    }
                },
                files: {
                    where: { file_usage: 'PRODUCT_IMAGE' },
                    take: 1
                }
            }
        });

        return trendingProducts.map(trending => {
            const product = products.find(p => p.id === trending.product_id);
            const productContent = product?.contents?.[0];

            return {
                product: {
                    ...product,
                    name: productContent?.name
                },
                viewCount: trending._count,
                period: `${days} روز گذشته`,
                rank: trendingProducts.indexOf(trending) + 1,
                display_price: product?.base_min_price || 0
            };
        });
    }

    // بقیه متدها به همین صورت به‌روزرسانی می‌شوند...
    // برای جلوگیری از طولانی شدن، ادامه می‌دهیم...

    private getInteractionInclude(language: Language) {
        return {
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

// در src/interactions/interactions.service.ts این متدها رو اضافه کن:

    async getPopularAccounts(limit: number = 10, language: Language = this.DEFAULT_LANGUAGE) {
        const popularAccounts = await this.prisma.interaction.groupBy({
            by: ['account_id'],
            where: {
                account_id: { not: null },
                type: { in: [InteractionType.LIKE, InteractionType.SAVE] }
            },
            _count: {
                _all: true
            },
            orderBy: {
                _count: {
                    account_id: 'desc'
                }
            },
            take: limit
        });

        const accountIds = popularAccounts.map(a => a.account_id);
        const accounts = await this.prisma.account.findMany({
            where: { id: { in: accountIds } },
            select: {
                id: true,
                profile_photo: true,
                activity_type: true,
                total_views: true,
                total_likes: true,
                contents: {
                    where: { language },
                    select: {
                        name: true,
                        company_name: true
                    }
                },
                _count: {
                    select: {
                        products: true
                    }
                }
            }
        });

        return popularAccounts.map(popular => {
            const account = accounts.find(a => a.id === popular.account_id);
            const accountContent = account?.contents?.[0];

            return {
                account: {
                    ...account,
                    name: accountContent?.name || accountContent?.company_name
                },
                interactionCount: popular._count,
                rank: popularAccounts.indexOf(popular) + 1
            };
        });
    }

    async getMostLikedProducts(limit: number = 10, language: Language = this.DEFAULT_LANGUAGE) {
        return this.prisma.product.findMany({
            where: { total_likes: { gt: 0 } },
            select: {
                id: true,
                contents: {
                    where: { language },
                    select: { name: true }
                },
                base_min_price: true,
                total_likes: true,
                total_views: true,
                category: {
                    select: {
                        id: true,
                        contents: {
                            where: { language },
                            select: { name: true }
                        }
                    }
                },
                files: {
                    where: { file_usage: 'PRODUCT_IMAGE' },
                    take: 1
                },
                account: {
                    select: {
                        id: true,
                        profile_photo: true,
                        activity_type: true,
                        contents: {
                            where: { language },
                            select: {
                                name: true,
                                company_name: true
                            }
                        }
                    }
                }
            },
            orderBy: { total_likes: 'desc' },
            take: limit
        });
    }

    async getMostSavedProducts(limit: number = 10, language: Language = this.DEFAULT_LANGUAGE) {
        const mostSaved = await this.prisma.interaction.groupBy({
            by: ['product_id'],
            where: {
                product_id: { not: null },
                type: InteractionType.SAVE
            },
            _count: true,
            orderBy: { _count: { product_id: 'desc' } },
            take: limit
        });

        const productIds = mostSaved.map(p => p.product_id);
        const products = await this.prisma.product.findMany({
            where: { id: { in: productIds } },
            select: {
                id: true,
                contents: {
                    where: { language },
                    select: { name: true }
                },
                base_min_price: true,
                total_views: true,
                total_likes: true,
                category: {
                    select: {
                        id: true,
                        contents: {
                            where: { language },
                            select: { name: true }
                        }
                    }
                },
                files: {
                    where: { file_usage: 'PRODUCT_IMAGE' },
                    take: 1
                }
            }
        });

        return mostSaved.map(saved => {
            const product = products.find(p => p.id === saved.product_id);
            const productContent = product?.contents?.[0];

            return {
                product: {
                    ...product,
                    name: productContent?.name
                },
                saveCount: saved._count,
                rank: mostSaved.indexOf(saved) + 1,
                display_price: product?.base_min_price || 0
            };
        });
    }
}