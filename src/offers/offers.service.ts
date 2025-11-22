// src/offers/offers.service.ts
import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    ConflictException,
    Inject,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { OfferQueryDto } from './dto/offer-query.dto';
import { CounterOfferDto } from './dto/counter-offer.dto';
import {
    OfferStatus,
    OfferType,
    OfferPriority,
    SystemRole,
    AccountRole,
    Prisma,
    Language,
    BuyAdType,
    BuyAdStatus,
    User,
} from '@prisma/client';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

// تایپ‌های کمکی
// تایپ‌های کمکی
type OfferWithRelations = any;
type BuyAdWithOffers = any;

@Injectable()
export class OffersService {
    private readonly logger = new Logger(OffersService.name);
    private readonly CACHE_TTL = 5 * 60 * 1000;

    constructor(
        private prisma: PrismaService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
    ) {}

    // ==================== متدهای اصلی ====================

    async create(createOfferDto: CreateOfferDto, userId: string, language: Language = Language.fa) {
        const buyAd = await this.validateBuyAdForOffer(createOfferDto.buy_ad_id, userId);
        await this.validateUserAccess(createOfferDto.account_id, userId);

        const validation = await this.validateOfferAgainstBuyAd(createOfferDto, buyAd, userId);
        if (!validation.isValid) {
            throw new BadRequestException(validation.errors.join(', '));
        }

        return this.prisma.$transaction(async (tx) => {
            const offerData = this.buildOfferData(createOfferDto, userId);

            const offer = await tx.offer.create({
                data: offerData,
                include: this.getOfferBasicInclude(language)
            });

            await this.updateBuyAdOfferStats(createOfferDto.buy_ad_id, tx);
            await this.clearOfferCaches(userId, createOfferDto.account_id, createOfferDto.buy_ad_id);

            return offer;
        });
    }

    async findAllByUser(filters: OfferQueryDto & { language?: Language }, userId: string) {
        const { page = 1, limit = 10, sort_by = 'newest', language = Language.fa, ...whereFilters } = filters;
        const skip = (page - 1) * limit;

        const where = this.buildUserOffersWhere(userId, whereFilters);

        const [offers, total] = await Promise.all([
            this.prisma.offer.findMany({
                where,
                skip,
                take: limit,
                include: this.getOfferListInclude(language),
                orderBy: this.buildOfferOrderBy(sort_by),
            }),
            this.prisma.offer.count({ where }),
        ]);

        const enrichedOffers = await this.enrichOffersWithAdditionalData(offers, language);

        return {
            offers: enrichedOffers,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        };
    }

    async findOne(id: string, userId?: string, language: Language = Language.fa) {
        const cacheKey = `offer:${id}:${language}`;
        const cached = await this.cacheManager.get(cacheKey);
        if (cached) return cached;

        const offer = await this.prisma.offer.findUnique({
            where: { id },
            include: this.getOfferDetailInclude(language)
        });

        if (!offer) {
            throw new NotFoundException('پیشنهاد یافت نشد');
        }

        const result = await this.enrichOfferWithUserPermissions(offer, userId);

        if (userId && this.shouldMarkAsSeen(offer, userId)) {
            await this.markOfferAsSeen(id);
        }

        await this.cacheManager.set(cacheKey, result, this.CACHE_TTL);
        return result;
    }

    async update(id: string, updateOfferDto: UpdateOfferDto, userId: string, language: Language = Language.fa) {
        const offer = await this.findOfferForUpdate(id, userId);

        if (!this.canEditOffer(offer)) {
            throw new ConflictException('این پیشنهاد قابل ویرایش نیست');
        }

        // جدا کردن contents از داده‌های اصلی
        const { contents, ...updateData } = updateOfferDto;

        let updatedOffer;

        if (contents && contents.length > 0) {
            // آپدیت پیشنهاد اصلی
            updatedOffer = await this.prisma.offer.update({
                where: { id },
                data: updateData,
                include: this.getOfferBasicInclude(language)
            });

            // آپدیت محتوای چندزبانه
            await Promise.all(
                contents.map(content =>
                    this.prisma.offerContent.upsert({
                        where: {
                            offer_id_language: {
                                offer_id: id,
                                language: content.language
                            }
                        },
                        create: {
                            offer_id: id,
                            language: content.language,
                            description: content.description,
                            packaging_details: content.packaging_details,
                            certifications_note: content.certifications_note,
                            shipping_note: content.shipping_note,
                            auto_translated: content.auto_translated || true,
                        },
                        update: {
                            description: content.description,
                            packaging_details: content.packaging_details,
                            certifications_note: content.certifications_note,
                            shipping_note: content.shipping_note,
                            auto_translated: content.auto_translated,
                        }
                    })
                )
            );

            // دریافت پیشنهاد با محتوای به‌روز شده
            updatedOffer = await this.prisma.offer.findUnique({
                where: { id },
                include: this.getOfferBasicInclude(language)
            });
        } else {
            // آپدیت ساده بدون محتوای چندزبانه
            updatedOffer = await this.prisma.offer.update({
                where: { id },
                data: updateData,
                include: this.getOfferBasicInclude(language)
            });
        }

        await this.clearOfferCaches(userId, offer.account_id, offer.buy_ad_id);
        return updatedOffer;
    }
    async remove(id: string, userId: string) {
        const offer = await this.findOfferForDeletion(id, userId);

        if (!this.canWithdrawOffer(offer)) {
            throw new ConflictException('این پیشنهاد قابل حذف نیست');
        }

        await this.prisma.$transaction(async (tx) => {
            if (offer.parent_offer_id) {
                await tx.offer.update({
                    where: { id: offer.parent_offer_id },
                    data: { status: OfferStatus.PENDING }
                });
            }

            await tx.offer.delete({ where: { id } });
            await this.updateBuyAdOfferStats(offer.buy_ad_id, tx);
        });

        await this.clearOfferCaches(userId, offer.account_id, offer.buy_ad_id);
        return { message: 'پیشنهاد با موفقیت حذف شد' };
    }

    // ==================== متدهای مدیریتی ====================

    async findByBuyAd(buyAdId: string, filters: any, userId?: string) {
        const { page = 1, limit = 10, sort_by = 'newest', language = Language.fa, ...whereFilters } = filters;
        const skip = (page - 1) * limit;

        const buyAd = await this.validateBuyAdAccess(buyAdId, userId);
        const where = this.buildBuyAdOffersWhere(buyAdId, whereFilters, buyAd.type);

        const [offers, total] = await Promise.all([
            this.prisma.offer.findMany({
                where,
                skip,
                take: limit,
                include: this.getOfferListInclude(language),
                orderBy: this.buildOfferOrderBy(sort_by),
            }),
            this.prisma.offer.count({ where }),
        ]);

        return {
            offers,
            total,
            page,
            totalPages: Math.ceil(total / limit),
            auction_info: buyAd.type === BuyAdType.AUCTION ?
                this.buildAuctionInfo(offers) : null
        };
    }

    async acceptOffer(id: string, userId: string, language: Language = Language.fa) {
        const offer = await this.findOfferForAcceptance(id, userId);

        return this.prisma.$transaction(async (tx) => {
            const acceptedOffer = await tx.offer.update({
                where: { id },
                data: { status: OfferStatus.ACCEPTED },
                include: this.getOfferBasicInclude(language)
            });

            await this.handlePostAcceptanceActions(offer, id, tx);
            const conversation = await this.createAcceptanceConversation(offer, userId, tx, language);

            await this.clearOfferCaches(offer.seller_id, offer.account_id, offer.buy_ad_id);

            return {
                offer: acceptedOffer,
                conversation_id: conversation.id,
                message: 'پیشنهاد با موفقیت پذیرفته شد و مکالمه جدید ایجاد گردید'
            };
        });
    }

    async rejectOffer(id: string, userId: string, reason?: string) {
        const offer = await this.findOfferForRejection(id, userId);

        const rejectedOffer = await this.prisma.offer.update({
            where: { id },
            data: {
                status: OfferStatus.REJECTED,
                ...(reason && { description: `${offer.description || ''} - دلیل رد: ${reason}`.trim() })
            }
        });

        await this.clearOfferCaches(offer.seller_id, offer.account_id, offer.buy_ad_id);
        return { message: 'پیشنهاد با موفقیت رد شد', offer: rejectedOffer };
    }

    async counterOffer(id: string, counterOfferDto: CounterOfferDto, userId: string, language: Language = Language.fa) {
        const offer = await this.findOfferForCounter(id, userId);

        if (!this.canCounterOffer(offer.buy_ad.type)) {
            throw new ConflictException('برای این نوع درخواست خرید، پیشنهاد متقابل مجاز نیست');
        }

        return this.prisma.$transaction(async (tx) => {
            const counterOffer = await tx.offer.create({
                data: this.buildCounterOfferData(offer, counterOfferDto),
                include: this.getOfferBasicInclude(language)
            });

            await tx.offer.update({
                where: { id },
                data: { status: OfferStatus.PENDING }
            });

            await this.updateBuyAdOfferStats(offer.buy_ad_id, tx);
            await this.clearOfferCaches(offer.seller_id, offer.account_id, offer.buy_ad_id);

            return counterOffer;
        });
    }

    async markAsSeen(id: string, userId: string) {
        const offer = await this.prisma.offer.findUnique({
            where: { id },
            include: { buy_ad: { select: { user_id: true } } }
        });

        if (!offer) {
            throw new NotFoundException('پیشنهاد یافت نشد');
        }

        if (offer.buy_ad.user_id !== userId) {
            throw new ForbiddenException('فقط خریدار می‌تواند پیشنهاد را علامت‌گذاری کند');
        }

        if (!offer.is_seen_by_buyer) {
            await this.prisma.offer.update({
                where: { id },
                data: {
                    is_seen_by_buyer: true,
                    seen_by_buyer_at: new Date()
                }
            });
        }

        return { message: 'پیشنهاد به عنوان دیده شده علامت‌گذاری شد' };
    }

    // ==================== متدهای آمار و گزارش ====================

    async getOfferStats(userId: string, timeframe: string = '30d') {
        const dateFilter = this.buildDateFilter(timeframe);

        const stats = await this.prisma.offer.groupBy({
            by: ['status'],
            where: {
                seller_id: userId,
                created_at: dateFilter
            },
            _count: true
        });

        const total = stats.reduce((sum, item) => sum + item._count, 0);
        const accepted = stats.find(item => item.status === OfferStatus.ACCEPTED)?._count || 0;
        const pending = stats.find(item => item.status === OfferStatus.PENDING)?._count || 0;

        return {
            total_offers: total,
            accepted_offers: accepted,
            pending_offers: pending,
            success_rate: total > 0 ? Math.round((accepted / total) * 100) : 0,
            timeframe
        };
    }

    async getNegotiationHistory(userId: string, buyAdId?: string, page: number = 1, limit: number = 10) {
        const skip = (page - 1) * limit;

        const where: Prisma.OfferWhereInput = {
            OR: [
                { seller_id: userId },
                {
                    buy_ad: { user_id: userId },
                    status: { in: [OfferStatus.PENDING, OfferStatus.COUNTERED, OfferStatus.ACCEPTED] }
                }
            ],
            ...(buyAdId && { buy_ad_id: buyAdId })
        };

        const [offers, total] = await Promise.all([
            this.prisma.offer.findMany({
                where,
                skip,
                take: limit,
                include: {
                    seller: { select: { id: true, user_name: true } },
                    buy_ad: {
                        select: {
                            id: true,
                            contents: { where: { language: Language.fa }, select: { name: true } }
                        }
                    },
                    parent_offer: { select: { id: true, proposed_price: true } },
                    child_offers: {
                        select: { id: true, proposed_price: true, created_at: true },
                        orderBy: { created_at: 'desc' },
                        take: 5
                    }
                },
                orderBy: { updated_at: 'desc' }
            }),
            this.prisma.offer.count({ where })
        ]);

        return {
            negotiations: offers.map(offer => ({
                id: offer.id,
                type: offer.type,
                status: offer.status,
                proposed_price: offer.proposed_price,
                created_at: offer.created_at,
                updated_at: offer.updated_at,
                seller: offer.seller,
                buy_ad: offer.buy_ad,
                negotiation_chain: this.buildNegotiationChain(offer),
                is_user_seller: offer.seller_id === userId
            })),
            total,
            page,
            totalPages: Math.ceil(total / limit)
        };
    }

    // ==================== متدهای مدیریتی (ادمین) ====================

    async findAllAdmin(filters: any) {
        const { page = 1, limit = 20, sort_by = 'newest', language = Language.fa, ...whereFilters } = filters;
        const skip = (page - 1) * limit;

        const where = this.buildAdminWhere(whereFilters);

        const [offers, total] = await Promise.all([
            this.prisma.offer.findMany({
                where,
                skip,
                take: limit,
                include: this.getOfferListInclude(language),
                orderBy: this.buildOfferOrderBy(sort_by),
            }),
            this.prisma.offer.count({ where }),
        ]);

        return {
            offers,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        };
    }

    async findOneAdmin(id: string, language: Language = Language.fa) {
        const offer = await this.prisma.offer.findUnique({
            where: { id },
            include: this.getOfferDetailInclude(language)
        });

        if (!offer) {
            throw new NotFoundException('پیشنهاد یافت نشد');
        }

        return {
            ...offer,
            admin_info: {
                can_force_delete: true,
                has_conversation: !!offer.conversation_id,
                child_offers_count: offer.child_offers?.length || 0
            }
        };
    }

    async forceRemove(id: string, adminId: string) {
        const offer = await this.prisma.offer.findUnique({
            where: { id },
            include: {
                child_offers: { select: { id: true } },
                conversation: { select: { id: true } }
            }
        });

        if (!offer) {
            throw new NotFoundException('پیشنهاد یافت نشد');
        }

        await this.prisma.$transaction(async (tx) => {
            // حذف پیشنهادهای فرزند
            if (offer.child_offers.length > 0) {
                await tx.offer.deleteMany({
                    where: { parent_offer_id: id }
                });
            }

            // حذف مکالمه مرتبط
            if (offer.conversation) {
                await tx.message.deleteMany({
                    where: { conversation_id: offer.conversation.id }
                });
                await tx.conversation.delete({
                    where: { id: offer.conversation.id }
                });
            }

            // حذف پیشنهاد اصلی
            await tx.offer.delete({ where: { id } });

            // آپدیت آمار
            await this.updateBuyAdOfferStats(offer.buy_ad_id, tx);
        });

        await this.clearAllOfferCaches();
        return { message: 'پیشنهاد با موفقیت حذف شد' };
    }

    async getAdminStats(timeframe: string = '30d') {
        const dateFilter = this.buildDateFilter(timeframe);

        const [
            totalOffers,
            offersByStatus,
            offersByType,
            recentActivity
        ] = await Promise.all([
            this.prisma.offer.count({ where: { created_at: dateFilter } }),
            this.prisma.offer.groupBy({
                by: ['status'],
                where: { created_at: dateFilter },
                _count: true
            }),
            this.prisma.offer.groupBy({
                by: ['type'],
                where: { created_at: dateFilter },
                _count: true
            }),
            this.prisma.offer.findMany({
                where: { created_at: dateFilter },
                orderBy: { created_at: 'desc' },
                take: 10,
                include: {
                    seller: { select: { user_name: true } },
                    buy_ad: { select: { id: true } }
                }
            })
        ]);

        return {
            overview: {
                total_offers: totalOffers,
                timeframe
            },
            by_status: offersByStatus.reduce((acc, item) => {
                acc[item.status] = item._count;
                return acc;
            }, {}),
            by_type: offersByType.reduce((acc, item) => {
                acc[item.type] = item._count;
                return acc;
            }, {}),
            recent_activity: recentActivity
        };
    }

    async checkAndExpireOffers() {
        const expiredOffers = await this.prisma.offer.findMany({
            where: {
                status: OfferStatus.PENDING,
                validity_hours: { not: null },
                created_at: {
                    lt: new Date(Date.now() - 24 * 60 * 60 * 1000) // پیشنهادات قدیمی‌تر از 24 ساعت
                }
            },
            include: {
                buy_ad: { select: { id: true } }
            }
        });

        if (expiredOffers.length === 0) {
            return { message: 'هیچ پیشنهاد منقضی‌شده‌ای یافت نشد' };
        }

        const result = await this.prisma.$transaction(async (tx) => {
            const updateResult = await tx.offer.updateMany({
                where: {
                    id: { in: expiredOffers.map(offer => offer.id) }
                },
                data: { status: OfferStatus.EXPIRED }
            });

            // آپدیت آمار درخواست‌های خرید مربوطه
            const uniqueBuyAdIds = [...new Set(expiredOffers.map(offer => offer.buy_ad.id))];
            for (const buyAdId of uniqueBuyAdIds) {
                await this.updateBuyAdOfferStats(buyAdId, tx);
            }

            return updateResult;
        });

        this.logger.log(`تعداد ${result.count} پیشنهاد منقضی شد`);
        return {
            message: `تعداد ${result.count} پیشنهاد منقضی شد`,
            expired_count: result.count
        };
    }

    // ==================== متدهای عمومی ====================

    async getFeaturedOffers(limit: number = 6, language: Language = Language.fa) {
        const offers = await this.prisma.offer.findMany({
            where: {
                status: OfferStatus.ACCEPTED,
                buy_ad: {
                    status: 'APPROVED' // استفاده از BuyAdStatus
                }
            },
            take: limit,
            include: {
                seller: {
                    select: {
                        id: true,
                        user_name: true,
                        is_verified: true,
                        contents: { where: { language }, select: { first_name: true, last_name: true } }
                    }
                },
                account: {
                    select: {
                        id: true,
                        activity_type: true,
                        profile_photo: true,
                        contents: {
                            where: { language },
                            select: {
                                name: true,
                                company_name: true
                            }
                        }
                    }
                },
                buy_ad: {
                    select: {
                        id: true,
                        contents: { where: { language }, select: { name: true, description: true } }
                    }
                },
                contents: {
                    where: { language },
                    select: {
                        description: true,
                        packaging_details: true,
                        shipping_note: true
                    }
                }
            },
            orderBy: [{ created_at: 'desc' }, { proposed_price: 'desc' }]
        });

        return offers.map(offer => this.sanitizeOfferForPublic(offer));
    }

    async getPublicStats(language: Language = Language.fa) {
        const [totalOffers, successfulOffers, activeBuyAds, registeredSellers] = await Promise.all([
            this.prisma.offer.count({ where: { status: OfferStatus.ACCEPTED } }),
            this.prisma.offer.count({
                where: {
                    status: OfferStatus.ACCEPTED,
                    created_at: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
                }
            }),
            this.prisma.buyAd.count({
                where: {
                    buy_ad_status: BuyAdStatus.APPROVED, // استفاده از buy_ad_status
                    expires_at: { gt: new Date() }
                }
            }),
            this.prisma.user.count({
                where: { is_seller: true, is_blocked: false }
            })
        ]);

        return {
            overview: {
                total_successful_offers: totalOffers,
                recent_successful_offers: successfulOffers,
                active_buy_requests: activeBuyAds,
                registered_sellers: registeredSellers
            },
            success_metrics: {
                success_rate: totalOffers > 0 ? Math.round((successfulOffers / totalOffers) * 100) : 0,
                avg_response_time: '24 ساعت',
                customer_satisfaction: '95%'
            }
        };
    }

    async getOfferPreview(id: string, language: Language = Language.fa) {
        const offer = await this.prisma.offer.findUnique({
            where: {
                id,
                status: OfferStatus.ACCEPTED
            },
            include: {
                seller: {
                    select: {
                        id: true,
                        user_name: true,
                        is_verified: true,
                        contents: { where: { language }, select: { first_name: true, last_name: true } }
                    }
                },
                account: {
                    select: {
                        id: true,
                        activity_type: true,
                        profile_photo: true,
                        contents: {
                            where: { language },
                            select: {
                                name: true,
                                company_name: true,
                                description: true
                            }
                        }
                    }
                },
                buy_ad: {
                    select: {
                        id: true,
                        contents: { where: { language }, select: { name: true, description: true } }
                    }
                },
                contents: {
                    where: { language },
                    select: {
                        description: true,
                        packaging_details: true
                    }
                }
            }
        });

        if (!offer) {
            throw new NotFoundException('پیشنهاد یافت نشد');
        }

        const offerContent = offer.contents[0];
        const accountContent = offer.account.contents[0];
        const buyAdContent = offer.buy_ad.contents[0];

        return {
            id: offer.id,
            proposed_price: offer.proposed_price,
            proposed_amount: offer.proposed_amount,
            unit: offer.unit,
            delivery_time: offer.delivery_time,
            description: offerContent?.description?.substring(0, 200) + '...',
            created_at: offer.created_at,
            type: offer.type,

            seller: {
                user_name: offer.seller.user_name,
                is_verified: offer.seller.is_verified,
                full_name: offer.seller.contents[0] ?
                    `${offer.seller.contents[0].first_name} ${offer.seller.contents[0].last_name}`.trim() :
                    'فروشنده'
            },

            account: {
                name: accountContent?.name || accountContent?.company_name,
                activity_type: offer.account.activity_type,
                profile_photo: offer.account.profile_photo,
                description: accountContent?.description?.substring(0, 100) + '...'
            },

            buy_ad: {
                name: buyAdContent?.name,
                description: buyAdContent?.description?.substring(0, 150) + '...'
            },

            registration_benefits: {
                title: 'برای مشاهده جزئیات کامل ثبت‌نام کنید',
                benefits: [
                    'مشاهده اطلاعات تماس فروشنده',
                    'دسترسی به هزاران درخواست خرید',
                    'ارسال پیشنهاد نامحدود',
                    'مذاکره مستقیم با خریداران',
                    'سیستم امتیازدهی و اعتبار'
                ],
                stats: {
                    average_success_rate: '۸۷٪',
                    active_buyers: '۵,۰۰۰+',
                    monthly_transactions: '۲,۵۰۰+'
                }
            }
        };
    }

    async getSuccessStories(limit: number = 4, language: Language = Language.fa) {
        const offers = await this.prisma.offer.findMany({
            where: {
                status: OfferStatus.ACCEPTED,
                buyer_rating: { gte: 4 },
                seller_rating: { gte: 4 }
            },
            take: limit,
            include: {
                seller: {
                    select: {
                        id: true,
                        user_name: true,
                        is_verified: true,
                        contents: { where: { language }, select: { first_name: true, last_name: true } }
                    }
                },
                buy_ad: {
                    select: {
                        id: true,
                        contents: { where: { language }, select: { name: true } }
                    }
                }
            },
            orderBy: { created_at: 'desc' }
        });

        return offers.map(offer => ({
            id: offer.id,
            success_story: {
                title: `معامله موفق: ${offer.buy_ad.contents[0]?.name}`,
                description: `فروشنده "${offer.seller.contents[0]?.first_name || offer.seller.user_name}" با موفقیت پیشنهاد خود را به ارزش ${offer.proposed_price.toLocaleString()} ریال به فروش رساند.`,
                value: offer.proposed_price.toLocaleString() + ' ریال',
                rating: {
                    buyer: offer.buyer_rating,
                    seller: offer.seller_rating,
                    average: ((offer.buyer_rating + offer.seller_rating) / 2).toFixed(1)
                },
                date: offer.created_at
            },
            seller: {
                name: offer.seller.contents[0] ?
                    `${offer.seller.contents[0].first_name} ${offer.seller.contents[0].last_name}`.trim() :
                    offer.seller.user_name,
                is_verified: offer.seller.is_verified
            }
        }));
    }

    // ==================== متدهای کمکی خصوصی ====================

    private async validateBuyAdForOffer(buyAdId: string, userId: string): Promise<any> {
        const buyAd = await this.prisma.buyAd.findUnique({
            where: {
                id: buyAdId,
                buy_ad_status: BuyAdStatus.APPROVED // استفاده از buy_ad_status
            } as any, // برای دور زدن خطای تایپ
            include: {
                user: { select: { id: true } },
                offers: {
                    where: {
                        seller_id: userId,
                        status: { in: [OfferStatus.PENDING, OfferStatus.COUNTERED] }
                    }
                }
            }
        });

        if (!buyAd) {
            throw new NotFoundException('درخواست خرید فعال یافت نشد');
        }

        if (buyAd.user_id === userId) {
            throw new ForbiddenException('شما نمی‌توانید به درخواست خرید خودتان پیشنهاد دهید');
        }

        if (buyAd.offers.length > 0) {
            throw new ConflictException('شما قبلاً برای این درخواست خرید پیشنهاد فعال دارید');
        }

        return buyAd;
    }

    private async validateUserAccess(accountId: string, userId: string) {
        const [account, accountUser] = await Promise.all([
            this.prisma.account.findUnique({
                where: { id: accountId, is_active: true }
            }),
            this.prisma.accountUser.findUnique({
                where: {
                    user_id_account_id: { user_id: userId, account_id: accountId }
                }
            })
        ]);

        if (!account) {
            throw new NotFoundException('اکانت مربوطه یافت نشد یا غیرفعال است');
        }

        if (!accountUser) {
            throw new ForbiddenException('دسترسی به اکانت مورد نظر ندارید');
        }
    }

    private async validateOfferAgainstBuyAd(
        createOfferDto: CreateOfferDto,
        buyAd: any,
        userId: string
    ): Promise<{ isValid: boolean; errors: string[] }> {
        const errors: string[] = [];

        // اعتبارسنجی عمومی
        if (createOfferDto.unit !== buyAd.unit) {
            errors.push(`واحد اندازه‌گیری باید "${buyAd.unit}" باشد`);
        }

        // اعتبارسنجی بر اساس نوع درخواست خرید
        switch (buyAd.type) {
            case BuyAdType.SIMPLE:
                if (createOfferDto.type && createOfferDto.type !== OfferType.DIRECT_OFFER) {
                    errors.push('برای این درخواست خرید فقط پیشنهاد مستقیم مجاز است');
                }
                break;

            case BuyAdType.AUCTION:
                if (createOfferDto.type !== OfferType.AUCTION_BID) {
                    errors.push('برای مزایده فقط پیشنهاد مزایده مجاز است');
                }
                // بررسی شرایط خاص مزایده
                const auctionConditions = buyAd.conditions as any;
                if (auctionConditions?.base_min_price && createOfferDto.proposed_price < auctionConditions.base_min_price) {
                    errors.push('پیشنهاد قیمت باید بیشتر از حداقل قیمت پایه باشد');
                }
                break;

            case BuyAdType.TENDER:
                if (createOfferDto.type !== OfferType.TENDER_BID) {
                    errors.push('برای مناقصه فقط پیشنهاد مناقصه مجاز است');
                }
                break;

            case BuyAdType.NEGOTIATION:
                // استفاده از if جداگانه برای جلوگیری از خطای TypeScript
                if (createOfferDto.type) {
                    const allowedTypes = [OfferType.DIRECT_OFFER, OfferType.NEGOTIATION] as OfferType[];
                    if (!allowedTypes.includes(createOfferDto.type)) {
                        errors.push('برای مذاکره فقط پیشنهاد مستقیم یا مذاکره مجاز است');
                    }
                }
                break;
        }

        const buyAdConditions = buyAd.conditions as any;
        if (buyAdConditions?.min_seller_rating) {
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                select: { rating: true }
            });

            if ((user?.rating || 0) < buyAdConditions.min_seller_rating) {
                errors.push(`برای ارسال پیشنهاد نیاز به حداقل امتیاز ${buyAdConditions.min_seller_rating} دارید`);
            }
        }

        // اعتبارسنجی گواهی‌های مورد نیاز
        if (buyAdConditions?.required_certifications && buyAdConditions.required_certifications.length > 0) {
            const hasRequiredCerts = createOfferDto.certifications?.some(cert =>
                buyAdConditions.required_certifications.includes(cert)
            );
            if (!hasRequiredCerts) {
                errors.push(`گواهی‌های مورد نیاز: ${buyAdConditions.required_certifications.join(', ')}`);
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    private buildOfferData(createOfferDto: CreateOfferDto, userId: string): Prisma.OfferCreateInput {
        const baseData: Prisma.OfferCreateInput = {
            seller: {
                connect: { id: userId }
            },
            account: {
                connect: { id: createOfferDto.account_id }
            },
            buy_ad: {
                connect: { id: createOfferDto.buy_ad_id }
            },
            proposed_price: createOfferDto.proposed_price,
            proposed_amount: createOfferDto.proposed_amount,
            unit: createOfferDto.unit,
            status: OfferStatus.PENDING,
            type: createOfferDto.type || OfferType.DIRECT_OFFER,
            priority: createOfferDto.priority || OfferPriority.NORMAL,
            validity_hours: createOfferDto.validity_hours || 24,
            delivery_time: createOfferDto.delivery_time || 1,
        };

        // اضافه کردن فیلدهای اختیاری
        if (createOfferDto.shipping_cost !== undefined) {
            baseData.shipping_cost = createOfferDto.shipping_cost;
        }

        if (createOfferDto.shipping_time !== undefined) {
            baseData.shipping_time = createOfferDto.shipping_time;
        }

        if (createOfferDto.certifications) {
            baseData.certifications = createOfferDto.certifications;
        }

        if (createOfferDto.warranty_months !== undefined) {
            baseData.warranty_months = createOfferDto.warranty_months;
        }

        if (createOfferDto.quality_guarantee !== undefined) {
            baseData.quality_guarantee = createOfferDto.quality_guarantee;
        }

        // اضافه کردن محتوای چندزبانه
        if (createOfferDto.contents && createOfferDto.contents.length > 0) {
            baseData.contents = {
                create: createOfferDto.contents.map(content => ({
                    language: content.language,
                    description: content.description,
                    packaging_details: content.packaging_details,
                    certifications_note: content.certifications_note,
                    shipping_note: content.shipping_note,
                    auto_translated: content.auto_translated || true,
                }))
            };
        }

        // محاسبه expires_at اگر validity_hours وجود دارد
        if (createOfferDto.validity_hours) {
            baseData.expires_at = new Date(Date.now() + createOfferDto.validity_hours * 60 * 60 * 1000);
        }

        return baseData;
    }

    private buildUserOffersWhere(userId: string, filters: Partial<OfferQueryDto>): Prisma.OfferWhereInput {
        const where: Prisma.OfferWhereInput = { seller_id: userId };

        if (filters.status) where.status = filters.status;
        if (filters.buy_ad_id) where.buy_ad_id = filters.buy_ad_id;
        if (filters.account_id) where.account_id = filters.account_id;
        if (filters.min_price || filters.max_price) {
            where.proposed_price = {
                ...(filters.min_price && { gte: filters.min_price }),
                ...(filters.max_price && { lte: filters.max_price })
            };
        }

        return where;
    }

    private buildOfferOrderBy(sortBy?: string): Prisma.OfferOrderByWithRelationInput {
        const orderByMap: Record<string, Prisma.OfferOrderByWithRelationInput> = {
            'newest': { created_at: 'desc' },
            'oldest': { created_at: 'asc' },
            'price_low': { proposed_price: 'asc' },
            'price_high': { proposed_price: 'desc' },
            'delivery_fast': { delivery_time: 'asc' },
            'priority': { priority: 'desc' },
            'validity': { validity_hours: 'asc' }
        };

        return orderByMap[sortBy] || orderByMap['newest'];
    }

    private async enrichOffersWithAdditionalData(offers: any[], language: Language) {
        return Promise.all(
            offers.map(async (offer) => {
                const buyAd = await this.prisma.buyAd.findUnique({
                    where: { id: offer.buy_ad_id },
                    select: {
                        status: true,
                        expires_at: true,
                        contents: {
                            where: { language },
                            select: { name: true }
                        }
                    }
                });

                return {
                    ...offer,
                    buy_ad_status: buyAd?.status,
                    buy_ad_expires_at: buyAd?.expires_at,
                    buy_ad_name: buyAd?.contents[0]?.name,
                    can_edit: this.canEditOffer(offer),
                    can_withdraw: this.canWithdrawOffer(offer),
                    time_remaining: this.calculateTimeRemaining(offer)
                };
            })
        );
    }

    private async enrichOfferWithUserPermissions(offer: OfferWithRelations, userId?: string) {
        const userHasAccess = userId ? await this.checkOfferAccess(offer, userId) : false;
        const canEdit = userHasAccess && this.canEditOffer(offer);
        const canWithdraw = userHasAccess && this.canWithdrawOffer(offer);

        return {
            ...offer,
            user_has_access: userHasAccess,
            can_edit: canEdit,
            can_withdraw: canWithdraw,
            can_counter: userId === offer.buy_ad.user_id && offer.status === OfferStatus.PENDING,
            can_accept: userId === offer.buy_ad.user_id && offer.status === OfferStatus.PENDING,
            can_reject: userId === offer.buy_ad.user_id && offer.status === OfferStatus.PENDING,
            time_remaining: this.calculateTimeRemaining(offer),
            child_offers: offer.child_offers || []
        };
    }

    private async checkOfferAccess(offer: OfferWithRelations, userId: string): Promise<boolean> {
        return offer.seller_id === userId || offer.buy_ad.user_id === userId;
    }

    private canEditOffer(offer: any): boolean {
        return offer.status === OfferStatus.PENDING &&
            offer.type !== OfferType.AUCTION_BID;
    }

    private canWithdrawOffer(offer: any): boolean {
        return offer.status === OfferStatus.PENDING;
    }

    private calculateTimeRemaining(offer: any): number | null {
        if (!offer.validity_hours) return null;

        const expiryTime = new Date(offer.created_at);
        expiryTime.setHours(expiryTime.getHours() + offer.validity_hours);

        const now = new Date();
        const remainingMs = expiryTime.getTime() - now.getTime();

        return remainingMs > 0 ? Math.ceil(remainingMs / (1000 * 60 * 60)) : 0;
    }

    private shouldMarkAsSeen(offer: OfferWithRelations, userId: string): boolean {
        return userId === offer.buy_ad.user_id && !offer.is_seen_by_buyer;
    }

    private async markOfferAsSeen(offerId: string) {
        await this.prisma.offer.update({
            where: { id: offerId },
            data: {
                is_seen_by_buyer: true,
                seen_by_buyer_at: new Date()
            }
        });
    }

    private async findOfferForUpdate(id: string, userId: string) {
        const offer = await this.prisma.offer.findUnique({
            where: { id },
            include: {
                buy_ad: { select: { user_id: true, type: true } },
                child_offers: { select: { id: true } }
            }
        });

        if (!offer) {
            throw new NotFoundException('پیشنهاد یافت نشد');
        }

        if (offer.seller_id !== userId) {
            throw new ForbiddenException('شما فقط می‌توانید پیشنهادهای خود را ویرایش کنید');
        }

        return offer;
    }

    private async findOfferForDeletion(id: string, userId: string) {
        const offer = await this.prisma.offer.findUnique({
            where: { id },
            include: {
                buy_ad: { select: { user_id: true } },
                child_offers: { select: { id: true } }
            }
        });

        if (!offer) {
            throw new NotFoundException('پیشنهاد یافت نشد');
        }

        if (offer.seller_id !== userId) {
            throw new ForbiddenException('شما فقط می‌توانید پیشنهادهای خود را حذف کنید');
        }

        return offer;
    }

    private async validateBuyAdAccess(buyAdId: string, userId?: string) {
        const buyAd = await this.prisma.buyAd.findUnique({
            where: { id: buyAdId },
            select: {
                user_id: true,
                allow_public_offers: true,
                type: true
            }
        });

        if (!buyAd) {
            throw new NotFoundException('درخواست خرید یافت نشد');
        }

        const canSeeOffers = userId && (
            buyAd.user_id === userId ||
            buyAd.type === BuyAdType.AUCTION ||
            buyAd.allow_public_offers
        );

        if (!canSeeOffers) {
            throw new ForbiddenException('شما اجازه مشاهده پیشنهادات این درخواست خرید را ندارید');
        }

        return buyAd;
    }

    private buildBuyAdOffersWhere(buyAdId: string, filters: any, buyAdType: BuyAdType): Prisma.OfferWhereInput {
        const where: Prisma.OfferWhereInput = { buy_ad_id: buyAdId };

        if (filters.status) where.status = filters.status;
        if (filters.type) where.type = filters.type;

        // در مزایده، فقط پیشنهادات فعال را نشان بده
        if (buyAdType === BuyAdType.AUCTION) {
            where.status = OfferStatus.PENDING;
            where.OR = [
                { validity_hours: null },
                {
                    created_at: {
                        gt: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 ساعت گذشته
                    }
                }
            ];
        }

        return where;
    }

    private buildAuctionInfo(offers: any[]) {
        const prices = offers.map(o => o.proposed_price);
        return {
            total_bids: offers.length,
            highest_bid: prices.length > 0 ? Math.max(...prices) : null,
            lowest_bid: prices.length > 0 ? Math.min(...prices) : null,
            average_bid: prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null
        };
    }

    private async findOfferForAcceptance(id: string, userId: string) {
        const offer = await this.prisma.offer.findUnique({
            where: { id },
            include: {
                buy_ad: {
                    select: {
                        id: true,
                        user_id: true,
                        type: true,
                        contents: {
                            where: { language: Language.fa },
                            select: { name: true }
                        }
                    }
                }
            }
        });

        if (!offer) {
            throw new NotFoundException('پیشنهاد یافت نشد');
        }

        if (offer.buy_ad.user_id !== userId) {
            throw new ForbiddenException('فقط صاحب درخواست خرید می‌تواند پیشنهاد را بپذیرد');
        }

        if (offer.status !== OfferStatus.PENDING) {
            throw new ConflictException('فقط پیشنهادهای در حال انتظار قابل پذیرش هستند');
        }

        return offer;
    }

    private async handlePostAcceptanceActions(offer: any, acceptedOfferId: string, tx: any) {
        switch (offer.buy_ad.type) {
            case BuyAdType.AUCTION:
                await tx.offer.updateMany({
                    where: {
                        buy_ad_id: offer.buy_ad_id,
                        id: { not: acceptedOfferId },
                        status: OfferStatus.PENDING
                    },
                    data: { status: OfferStatus.REJECTED }
                });
                break;

            case BuyAdType.TENDER:
                await tx.offer.updateMany({
                    where: {
                        buy_ad_id: offer.buy_ad_id,
                        id: { not: acceptedOfferId }
                    },
                    data: { status: OfferStatus.REJECTED }
                });
                break;

            default:
                await tx.offer.updateMany({
                    where: {
                        buy_ad_id: offer.buy_ad_id,
                        id: { not: acceptedOfferId },
                        status: { in: [OfferStatus.PENDING, OfferStatus.COUNTERED] }
                    },
                    data: { status: OfferStatus.REJECTED }
                });
        }

        // غیرفعال کردن درخواست خرید
        await tx.buyAd.update({
            where: { id: offer.buy_ad_id },
            data: {
                status: BuyAdStatus.FULFILLED,
                fulfilled_at: new Date()
            }
        });

        await this.updateBuyAdOfferStats(offer.buy_ad_id, tx);
    }

    private async createAcceptanceConversation(offer: any, userId: string, tx: any, language: Language = Language.fa) {
        const buyAdName = offer.buy_ad.contents[0]?.name || 'درخواست خرید';

        const conversation = await tx.conversation.create({
            data: {
                user1_id: userId, // خریدار
                user2_id: offer.seller_id, // فروشنده
                buy_ad_id: offer.buy_ad_id,
                last_message_text: `پیشنهاد برای "${buyAdName}" پذیرفته شد`,
                last_message_time: new Date(),
            }
        });

        // پیام اولیه
        await tx.message.create({
            data: {
                content: `پیشنهاد شما برای "${buyAdName}" با قیمت ${offer.proposed_price.toLocaleString()} ریال پذیرفته شد. لطفاً برای ادامه هماهنگی‌ها پیام دهید.`,
                sender_id: userId,
                conversation_id: conversation.id,
            }
        });

        // آپدیت پیشنهاد با مکالمه
        await tx.offer.update({
            where: { id: offer.id },
            data: { conversation_id: conversation.id }
        });

        return conversation;
    }

    private async findOfferForRejection(id: string, userId: string) {
        const offer = await this.prisma.offer.findUnique({
            where: { id },
            include: {
                buy_ad: { select: { user_id: true } }
            }
        });

        if (!offer) {
            throw new NotFoundException('پیشنهاد یافت نشد');
        }

        if (offer.buy_ad.user_id !== userId) {
            throw new ForbiddenException('فقط صاحب درخواست خرید می‌تواند پیشنهاد را رد کند');
        }

        if (offer.status !== OfferStatus.PENDING) {
            throw new ConflictException('فقط پیشنهادهای در حال انتظار قابل رد هستند');
        }

        return offer;
    }

    private async findOfferForCounter(id: string, userId: string) {
        const offer = await this.prisma.offer.findUnique({
            where: { id },
            include: {
                buy_ad: {
                    select: {
                        user_id: true,
                        type: true
                    }
                }
            }
        });

        if (!offer) {
            throw new NotFoundException('پیشنهاد یافت نشد');
        }

        if (offer.buy_ad.user_id !== userId) {
            throw new ForbiddenException('فقط صاحب درخواست خرید می‌تواند پیشنهاد متقابل دهد');
        }

        if (offer.status !== OfferStatus.PENDING) {
            throw new ConflictException('فقط پیشنهادهای در حال انتظار قابل پاسخ متقابل هستند');
        }

        return offer;
    }

    private canCounterOffer(buyAdType: BuyAdType): boolean {
        return !([BuyAdType.AUCTION, BuyAdType.TENDER] as BuyAdType[]).includes(buyAdType);
    }

    private buildCounterOfferData(offer: any, counterOfferDto: CounterOfferDto) {
        return {
            buy_ad_id: offer.buy_ad_id,
            account_id: offer.account_id,
            seller_id: offer.seller_id,
            proposed_price: counterOfferDto.proposed_price,
            proposed_amount: offer.proposed_amount,
            unit: offer.unit,
            delivery_time: counterOfferDto.delivery_time || offer.delivery_time,
            description: counterOfferDto.description || `پیشنهاد متقابل: ${counterOfferDto.proposed_price.toLocaleString()} ریال`,
            status: OfferStatus.COUNTERED,
            type: OfferType.COUNTER_OFFER,
            parent_offer_id: offer.id,
            shipping_cost: counterOfferDto.shipping_cost,
            shipping_time: counterOfferDto.shipping_time,
            warranty_months: counterOfferDto.warranty_months,
            certifications: counterOfferDto.certifications || offer.certifications,
            validity_hours: counterOfferDto.validity_hours || 24,
            expires_at: counterOfferDto.validity_hours ?
                new Date(Date.now() + counterOfferDto.validity_hours * 60 * 60 * 1000) : null
        };
    }

    private buildDateFilter(timeframe: string): Prisma.DateTimeFilter {
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

    private buildNegotiationChain(offer: any) {
        const chain = [];

        if (offer.parent_offer) {
            chain.push({
                id: offer.parent_offer.id,
                price: offer.parent_offer.proposed_price,
                type: 'original'
            });
        }

        chain.push({
            id: offer.id,
            price: offer.proposed_price,
            type: 'current'
        });

        if (offer.child_offers && offer.child_offers.length > 0) {
            offer.child_offers.forEach((child: any) => {
                chain.push({
                    id: child.id,
                    price: child.proposed_price,
                    type: 'counter',
                    timestamp: child.created_at
                });
            });
        }

        return chain;
    }

    private buildAdminWhere(filters: any): Prisma.OfferWhereInput {
        const where: Prisma.OfferWhereInput = {};

        if (filters.status) where.status = filters.status;
        if (filters.type) where.type = filters.type;
        if (filters.user_id) where.seller_id = filters.user_id;
        if (filters.buy_ad_id) where.buy_ad_id = filters.buy_ad_id;
        if (filters.min_price || filters.max_price) {
            where.proposed_price = {
                ...(filters.min_price && { gte: filters.min_price }),
                ...(filters.max_price && { lte: filters.max_price })
            };
        }

        return where;
    }

    private async updateBuyAdOfferStats(buyAdId: string, tx: any): Promise<void> {
        const stats = await tx.offer.groupBy({
            by: ['status'],
            where: { buy_ad_id: buyAdId },
            _count: true
        });

        const totalOffers = stats.reduce((sum, item) => sum + item._count, 0);

        await tx.buyAd.update({
            where: { id: buyAdId },
            data: {
                total_offers: totalOffers,
                last_offer_at: new Date(),
            }
        });
    }

    private sanitizeOfferForPublic(offer: any) {
        return {
            id: offer.id,
            proposed_price: offer.proposed_price,
            proposed_amount: offer.proposed_amount,
            unit: offer.unit,
            delivery_time: offer.delivery_time,
            description: offer.description?.substring(0, 150) + '...',
            created_at: offer.created_at,

            seller: {
                id: offer.seller.id,
                user_name: offer.seller.user_name,
                is_verified: offer.seller.is_verified,
                full_name: offer.seller.contents[0] ?
                    `${offer.seller.contents[0].first_name} ${offer.seller.contents[0].last_name}`.trim() :
                    null
            },

            account: {
                id: offer.account.id,
                name: offer.account.contents[0]?.name || offer.account.name,
                activity_type: offer.account.activity_type,
                profile_photo: offer.account.profile_photo
            },

            buy_ad: {
                id: offer.buy_ad.id,
                name: offer.buy_ad.contents[0]?.name,
                description: offer.buy_ad.contents[0]?.description?.substring(0, 100) + '...'
            },

            call_to_action: {
                message: 'برای مشاهده جزئیات کامل و تماس با فروشنده ثبت‌نام کنید',
                benefits: [
                    'مشاهده اطلاعات تماس کامل',
                    'ارسال پیشنهاد به درخواست‌های خرید',
                    'مذاکره مستقیم با خریداران',
                    'دسترسی به هزاران فرصت تجاری'
                ]
            }
        };
    }

    private async clearOfferCaches(userId: string, accountId: string, buyAdId: string): Promise<void> {
        const patterns = [
            `user_offers:${userId}:*`,
            `buy_ad_offers:${buyAdId}:*`,
            `offer:${accountId}:*`,
            `offer_stats:${userId}:*`
        ];

        try {
            for (const pattern of patterns) {
                await this.clearPatternKeys(pattern);
            }
        } catch (error) {
            this.logger.error('Error clearing offer caches:', error);
        }
    }

    private async clearAllOfferCaches(): Promise<void> {
        const patterns = [
            'user_offers:*',
            'buy_ad_offers:*',
            'offer:*',
            'offer_stats:*'
        ];

        try {
            for (const pattern of patterns) {
                await this.clearPatternKeys(pattern);
            }
        } catch (error) {
            this.logger.error('Error clearing all offer caches:', error);
        }
    }

    private async clearPatternKeys(pattern: string): Promise<void> {
        try {
            // روش جایگزین برای cache-manager جدید
            // اگر از redis استفاده می‌کنی، باید client رو مستقیماً بگیریم
            const client = (this.cacheManager as any).store?.getClient?.();

            if (client && typeof client.keys === 'function') {
                // برای redis
                const keys = await new Promise<string[]>((resolve, reject) => {
                    client.keys(pattern, (err: any, result: string[]) => {
                        if (err) reject(err);
                        else resolve(result);
                    });
                });

                for (const key of keys) {
                    await this.cacheManager.del(key);
                }
            } else {
                // برای memory cache یا سایر storeها
                // متأسفانه pattern clearing در memory cache ساده نیست
                this.logger.warn(`Pattern clearing not supported for this cache store: ${pattern}`);
            }
        } catch (error) {
            this.logger.warn(`Could not clear pattern ${pattern}:`, error);
        }
    }

    private getOfferBasicInclude(language: Language) {
        return {
            seller: {
                select: {
                    id: true,
                    user_name: true,
                    is_verified: true,
                    contents: { where: { language }, select: { first_name: true, last_name: true } }
                }
            },
            account: {
                select: {
                    id: true,
                    name: true,
                    activity_type: true,
                }
            },
            buy_ad: {
                select: {
                    id: true,
                    contents: { where: { language }, select: { name: true } }
                }
            }
        };
    }

    private getOfferListInclude(language: Language) {
        return {
            ...this.getOfferBasicInclude(language),
            account: {
                select: {
                    id: true,
                    name: true,
                    activity_type: true,
                    profile_photo: true,
                }
            },
            buy_ad: {
                select: {
                    id: true,
                    contents: { where: { language }, select: { name: true } },
                    user: {
                        select: {
                            id: true,
                            user_name: true,
                            contents: { where: { language }, select: { first_name: true, last_name: true } }
                        }
                    }
                }
            }
        };
    }

    private getOfferDetailInclude(language: Language): Prisma.OfferInclude {
        return {
            seller: {
                select: {
                    id: true,
                    user_name: true,
                    is_verified: true,
                    response_rate: true,
                    rating: true,
                    contents: {
                        where: { language },
                        select: { first_name: true, last_name: true }
                    }
                }
            },
            account: {
                select: {
                    id: true,
                    activity_type: true,
                    profile_photo: true,
                    contents: {
                        where: { language },
                        select: {
                            name: true,
                            company_name: true,
                            description: true
                        }
                    }
                }
            },
            buy_ad: {
                select: {
                    id: true,
                    type: true,
                    status: true,
                    user_id: true,
                    contents: {
                        where: { language },
                        select: { name: true, description: true }
                    },
                    user: {
                        select: {
                            id: true,
                            user_name: true,
                            is_verified: true,
                            contents: {
                                where: { language },
                                select: { first_name: true, last_name: true }
                            }
                        }
                    }
                }
            },
            contents: {
                where: { language },
                select: {
                    description: true,
                    packaging_details: true,
                    certifications_note: true,
                    shipping_note: true,
                    buyer_feedback: true,
                    seller_feedback: true
                }
            },
            parent_offer: {
                include: {
                    seller: {
                        select: {
                            id: true,
                            user_name: true,
                            contents: {
                                where: { language },
                                select: { first_name: true, last_name: true }
                            }
                        }
                    },
                    contents: {
                        where: { language },
                        select: { description: true }
                    }
                }
            },
            child_offers: {
                include: {
                    seller: {
                        select: {
                            id: true,
                            user_name: true,
                            contents: {
                                where: { language },
                                select: { first_name: true, last_name: true }
                            }
                        }
                    },
                    contents: {
                        where: { language },
                        select: { description: true }
                    }
                },
                orderBy: { created_at: 'desc' } as Prisma.OfferOrderByWithRelationInput
            },
            conversation: {
                select: {
                    id: true,
                    user1_id: true,
                    user2_id: true,
                    last_message_text: true,
                    last_message_time: true,
                }
            }
        };
    }
}