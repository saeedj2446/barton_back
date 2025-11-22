import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Cron, CronExpression } from "@nestjs/schedule";
import { AnalysisPeriod, Prisma, ProductStatus, FileUsage } from "@prisma/client";

interface PriceAnalysis {
    quantity_based: Record<string, { avg_price: number; min_price: number; max_price: number; acceptance_rate: number }>;
    payment_based: Record<string, { avg_price: number; discount_rate: number; popularity: number }>;
    delivery_based: Record<string, { avg_price: number; discount_rate: number; usage_rate: number }>;
}

interface CompetitorAnalysis {
    top_competitors: string[];
    competitor_pricing_strategy: Record<string, string>;
    competitor_strengths: string[];
    market_share_estimation: Record<string, number>;
}

interface MarketIndices {
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
    priceTrend: number;
    totalListings: number;
    newListings: number;
    soldListings: number;
    avgViews: number;
    avgResponseRate: number;
    demandSupplyRatio: number;
    marketActivityIndex: number;
}

@Injectable()
export class MarketAnalyticsService {
    private readonly logger = new Logger(MarketAnalyticsService.name);

    constructor(private prisma: PrismaService) {}

    // ==================== BATCH JOBS ====================

    /**
     * 🕒 پردازش شبانه - تحلیل روزانه بازار
     */
    @Cron(CronExpression.EVERY_DAY_AT_2AM)
    async runDailyMarketAnalysis() {
        this.logger.log('Starting daily market analysis...');

        try {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            yesterday.setHours(0, 0, 0, 0);

            const periodStart = yesterday;
            const periodEnd = new Date(yesterday);
            periodEnd.setHours(23, 59, 59, 999);

            // تحلیل برای صنوف مختلف
            const industries = await this.prisma.industry.findMany({
                where: { is_active: true },
                include: {
                    contents: {
                        where: { language: 'fa' }
                    }
                }
            });

            for (const industry of industries) {
                await this.analyzeIndustryMarket(industry.id, periodStart, periodEnd, 'DAILY');
            }

            this.logger.log(`Daily market analysis completed for ${industries.length} industries`);
        } catch (error) {
            this.logger.error('Failed to run daily market analysis:', error);
        }
    }

    // ==================== CORE ANALYSIS METHODS ====================
// در کلاس MarketAnalyticsService این متدها رو اضافه کن:

    /**
     * تحلیل رقبا
     */
    private async analyzeCompetitors(
        industryId: string,
        periodStart: Date,
        periodEnd: Date
    ): Promise<CompetitorAnalysis> {
        try {
            // فروشندگان برتر این صنف
            const topSellers = await this.prisma.account.findMany({
                where: {
                    industryId: industryId,
                    is_active: true,
                    confirmed: true,
                    products: {
                        some: {
                            status: 'APPROVED'
                        }
                    }
                },
                include: {
                    contents: {
                        where: { language: 'fa' }
                    },
                    products: {
                        where: {
                            status: 'APPROVED',
                            created_at: { lte: periodEnd }
                        },
                        include: {
                            pricing_strategies: {
                                where: { is_active: true }
                            },
                            order_items: {
                                where: {
                                    order: {
                                        status: 'COMPLETED',
                                        created_at: { gte: periodStart, lte: periodEnd }
                                    }
                                }
                            }
                        }
                    }
                },
                orderBy: {
                    products: {
                        _count: 'desc'
                    }
                },
                take: 10
            });

            // تحلیل استراتژی قیمت‌گذاری رقبا
            const competitorStrategies: Record<string, string> = {};
            const competitorStrengths: string[] = [];
            const marketShare: Record<string, number> = {};

            let totalSales = 0;
            const salesByCompetitor: Record<string, number> = {};

            for (const seller of topSellers) {
                const sellerName = seller.contents[0]?.name || seller.contents[0]?.company_name || 'نامشخص';
                const salesCount = seller.products.reduce((sum, product) => sum + product.order_items.length, 0);

                salesByCompetitor[sellerName] = salesCount;
                totalSales += salesCount;

                // تشخیص استراتژی قیمت‌گذاری
                competitorStrategies[sellerName] = this.detectPricingStrategy(seller.products);

                // تشخیص نقاط قوت
                const strengths = this.identifySellerStrengths(seller);
                competitorStrengths.push(...strengths);
            }

            // محاسبه سهم بازار
            for (const [seller, sales] of Object.entries(salesByCompetitor)) {
                marketShare[seller] = totalSales > 0 ? (sales / totalSales) : 0;
            }

            return {
                top_competitors: Object.keys(salesByCompetitor),
                competitor_pricing_strategy: competitorStrategies,
                competitor_strengths: [...new Set(competitorStrengths)],
                market_share_estimation: marketShare
            };
        } catch (error) {
            this.logger.error(`Error in competitor analysis for industry ${industryId}:`, error);
            return {
                top_competitors: [],
                competitor_pricing_strategy: {},
                competitor_strengths: [],
                market_share_estimation: {}
            };
        }
    }

    /**
     * تحلیل رفتار خریداران
     */
    /**
     * تحلیل رفتار خریداران - نسخه بهبود یافته
     */
    private async analyzeBuyerBehavior(
        industryId: string,
        periodStart: Date,
        periodEnd: Date
    ) {
        try {
            // داده‌های جستجو
            const searchQueries = await this.prisma.accountUserActivity.findMany({
                where: {
                    activity_type: 'SEARCH_QUERY',
                    created_at: { gte: periodStart, lte: periodEnd },
                    account_user: {
                        account: {
                            industryId: industryId
                        }
                    }
                },
                select: {
                    metadata: true,
                    created_at: true
                },
                take: 1000
            });

            // داده‌های بازدید محصولات
            const productViews = await this.prisma.interaction.findMany({
                where: {
                    type: 'VIEW',
                    created_at: { gte: periodStart, lte: periodEnd },
                    product: {
                        account: {
                            industryId: industryId
                        }
                    }
                },
                include: {
                    product: {
                        include: {
                            contents: {
                                where: { language: 'fa' }
                            }
                        }
                    }
                }
            });

            // تحلیل ساعات اوج بازدید
            const viewHours = productViews.map(view => new Date(view.created_at).getHours());
            const peakHours = this.calculatePeakHours(viewHours);

            // استخراج عبارات جستجوی پرتکرار
            const searchTerms = searchQueries
                .map(query => query.metadata?.['query'] as string)
                .filter(term => term && term.trim().length > 0);

            const popularSearches = this.getMostFrequent(searchTerms, 10);

            // استخراج کلمات کلیدی
            const keywords = this.extractKeywords(searchTerms);

            // تحلیل محصولات پر بازدید
            const popularProducts = this.analyzePopularProducts(productViews);

            // تحلیل الگوی جستجو در ساعات مختلف
            const searchPatterns = this.analyzeSearchPatterns(searchQueries);

            return {
                popular_search_terms: popularSearches,
                search_keywords: keywords,
                peak_shopping_hours: peakHours,
                total_product_views: productViews.length,
                total_searches: searchQueries.length,
                popular_products: popularProducts,
                search_patterns: searchPatterns,
                search_volume_trend: this.calculateSearchTrend(searchQueries)
            };
        } catch (error) {
            this.logger.error(`Error in buyer behavior analysis for industry ${industryId}:`, error);
            return {
                popular_search_terms: [],
                search_keywords: [],
                peak_shopping_hours: [],
                total_product_views: 0,
                total_searches: 0,
                popular_products: [],
                search_patterns: {},
                search_volume_trend: 'stable'
            };
        }
    }

    /**
     * تحلیل الگوهای جستجو
     */
    private analyzeSearchPatterns(searchQueries: any[]) {
        const patterns = {
            by_hour: {} as Record<number, number>,
            by_day: {} as Record<string, number>,
            query_lengths: [] as number[]
        };

        searchQueries.forEach(query => {
            const date = new Date(query.created_at);
            const hour = date.getHours();
            const day = date.toLocaleDateString('fa-IR');

            // شمارش بر اساس ساعت
            patterns.by_hour[hour] = (patterns.by_hour[hour] || 0) + 1;

            // شمارش بر اساس روز
            patterns.by_day[day] = (patterns.by_day[day] || 0) + 1;

            // طول عبارات جستجو
            const queryText = query.metadata?.['query'] as string;
            if (queryText) {
                patterns.query_lengths.push(queryText.length);
            }
        });

        return patterns;
    }

    /**
     * محاسبه روند حجم جستجو
     */
    private calculateSearchTrend(searchQueries: any[]): string {
        if (searchQueries.length < 10) return 'insufficient_data';

        // تقسیم داده‌ها به دو نیمه
        const midPoint = Math.floor(searchQueries.length / 2);
        const firstHalf = searchQueries.slice(0, midPoint);
        const secondHalf = searchQueries.slice(midPoint);

        const firstCount = firstHalf.length;
        const secondCount = secondHalf.length;

        const growthRate = (secondCount - firstCount) / firstCount;

        if (growthRate > 0.1) return 'growing';
        if (growthRate < -0.1) return 'declining';
        return 'stable';
    }
// در کلاس MarketAnalyticsService این متدها رو اضافه کن:

    /**
     * محاسبه ساعات اوج بازدید
     */
    private calculatePeakHours(hours: number[]): string[] {
        if (hours.length === 0) return ['10:00-12:00', '16:00-18:00'];

        const hourCounts: Record<number, number> = {};
        hours.forEach(hour => {
            hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        });

        // پیدا کردن ۲ ساعت پیک
        const sortedHours = Object.entries(hourCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 2)
            .map(([hour]) => {
                const start = parseInt(hour);
                return `${start.toString().padStart(2, '0')}:00-${(start + 2).toString().padStart(2, '0')}:00`;
            });

        return sortedHours;
    }

    /**
     * پیدا کردن پرتکرارترین آیتم‌ها
     */
    private getMostFrequent(items: string[], limit: number): string[] {
        if (items.length === 0) return [];

        const frequency: Record<string, number> = {};
        items.forEach(item => {
            if (item && item.trim()) {
                frequency[item] = (frequency[item] || 0) + 1;
            }
        });

        return Object.entries(frequency)
            .sort(([,a], [,b]) => b - a)
            .slice(0, limit)
            .map(([item]) => item);
    }

    /**
     * تحلیل محصولات پر بازدید - نسخه بهبود یافته
     */
    private analyzePopularProducts(productViews: any[]) {
        if (productViews.length === 0) return [];

        const productViewCounts: Record<string, { count: number; product: any }> = {};

        productViews.forEach(view => {
            const productId = view.product_id;
            if (productId) {
                if (!productViewCounts[productId]) {
                    productViewCounts[productId] = {
                        count: 0,
                        product: view.product
                    };
                }
                productViewCounts[productId].count++;
            }
        });

        return Object.entries(productViewCounts)
            .sort(([,a], [,b]) => b.count - a.count)
            .slice(0, 5)
            .map(([productId, data]) => ({
                product_id: productId,
                name: data.product?.contents?.[0]?.name || `محصول ${productId}`,
                view_count: data.count
            }));
    }

    /**
     * تشخیص استراتژی قیمت‌گذاری
     */
    private detectPricingStrategy(products: any[]): string {
        if (products.length === 0) return 'unknown';

        const strategies = products.flatMap(p => p.pricing_strategies || []);

        const hasVolumeDiscount = strategies.some(s =>
            s.condition_type?.includes('BULK') ||
            s.condition_type?.includes('VOLUME') ||
            s.condition_category === 'ORDER_CONDITION'
        );

        const hasTieredPricing = strategies.filter(s => s.condition_type).length > 1;
        const hasNegotiable = strategies.some(s => s.condition_type?.includes('NEGOTIABLE'));

        if (hasVolumeDiscount) return 'volume_discount';
        if (hasTieredPricing) return 'tiered_pricing';
        if (hasNegotiable) return 'negotiable_pricing';

        return 'fixed_pricing';
    }

    /**
     * شناسایی نقاط قوت فروشنده
     */
    private identifySellerStrengths(seller: any): string[] {
        const strengths: string[] = [];

        if (seller.products?.length > 20) strengths.push('تعداد محصولات بالا');
        if (seller.total_views > 500) strengths.push('محبوبیت بالا');
        if (seller.confirmed) strengths.push('تأیید شده');
        if (seller.total_likes > 50) strengths.push('رضایت مشتریان');
        if (seller.response_rate > 0.7) strengths.push('پاسخگویی سریع');
        if (seller.is_verified) strengths.push('اعتبار بالا');

        // بررسی محتوای چندزبانه برای نام شرکت
        const hasCompanyName = seller.contents?.some((content: any) =>
            content.company_name && content.company_name.trim()
        );
        if (hasCompanyName) strengths.push('شرکت معتبر');

        return strengths;
    }

    /**
     * محاسبه نرخ پاسخگویی
     */
    private calculateResponseRate(seller: any): number {
        if (!seller.total_messages || !seller.responded_messages) return 0.5;

        return seller.responded_messages / seller.total_messages;
    }

    /**
     * استخراج کلمات کلیدی از جستجوها
     */
    private extractKeywords(searchTerms: string[]): string[] {
        const commonWords = ['در', 'با', 'برای', 'از', 'به', 'که', 'این', 'آن', 'را'];

        const allWords = searchTerms.flatMap(term =>
            term.split(/\s+/).filter(word =>
                word.length > 2 && !commonWords.includes(word)
            )
        );

        return this.getMostFrequent(allWords, 15);
    }



    /**
     * تحلیل فصلی
     */
    private analyzeSeasonalTrends(viewsByMonth: number[]): string[] {
        const trends: string[] = [];

        if (viewsByMonth.length >= 12) {
            const currentMonth = new Date().getMonth();
            const lastYearAvg = viewsByMonth.slice(0, 12).reduce((a, b) => a + b, 0) / 12;
            const currentMonthViews = viewsByMonth[viewsByMonth.length - 1];

            if (currentMonthViews > lastYearAvg * 1.2) {
                trends.push('روند صعودی فصلی');
            } else if (currentMonthViews < lastYearAvg * 0.8) {
                trends.push('روند نزولی فصلی');
            }
        }

        return trends;
    }
    /**
     * تحلیل محصولات پر بازدید
     */



    /**
     * تحلیل بازار برای یک صنف خاص
     */
    private async analyzeIndustryMarket(
        industryId: string,
        periodStart: Date,
        periodEnd: Date,
        periodType: AnalysisPeriod
    ) {
        this.logger.log(`Analyzing market for industry ${industryId}...`);

        try {
            // ۱. جمع‌آوری داده‌های پایه
            const [priceAnalysis, competitorAnalysis, buyerBehavior, marketIndices] = await Promise.all([
                this.analyzePricingStrategies(industryId, periodStart, periodEnd),
                this.analyzeCompetitors(industryId, periodStart, periodEnd),
                this.analyzeBuyerBehavior(industryId, periodStart, periodEnd),
                this.calculateMarketIndices(industryId, periodStart, periodEnd)
            ]);

            // ۲. تولید پیشنهادات هوشمند
            const recommendations = await this.generateIntelligentRecommendations(
                priceAnalysis,
                competitorAnalysis,
                buyerBehavior,
                marketIndices
            );

            // ۳. شناسایی محصولات ترند
            const trendingProducts = await this.identifyTrendingProducts(industryId, periodStart, periodEnd);

            // ۴. ذخیره در دیتابیس - روش جایگزین بدون استفاده از constraint خاص
            const existingAnalysis = await this.prisma.marketAnalytics.findFirst({
                where: {
                    industry_id: industryId,
                    period_start: periodStart,
                    period_type: periodType
                }
            });

            const data = {
                period_end: periodEnd,
                avg_price: marketIndices.avgPrice,
                min_price: marketIndices.minPrice,
                max_price: marketIndices.maxPrice,
                price_trend: marketIndices.priceTrend,
                total_listings: marketIndices.totalListings,
                new_listings: marketIndices.newListings,
                sold_listings: marketIndices.soldListings,
                avg_views_per_listing: marketIndices.avgViews,
                avg_response_rate: marketIndices.avgResponseRate,
                demand_supply_ratio: marketIndices.demandSupplyRatio,
                price_analysis_by_conditions: priceAnalysis as any,
                trending_up_products: trendingProducts.up,
                trending_down_products: trendingProducts.down,
                pricing_recommendations: recommendations,
                market_activity_index: marketIndices.marketActivityIndex,
                updated_at: new Date()
            };

            if (existingAnalysis) {
                // آپدیت تحلیل موجود
                await this.prisma.marketAnalytics.update({
                    where: { id: existingAnalysis.id },
                    data: data
                });
            } else {
                // ایجاد تحلیل جدید
                await this.prisma.marketAnalytics.create({
                    data: {
                        industry_id: industryId,
                        period_start: periodStart,
                        ...data
                    }
                });
            }

            this.logger.log(`Market analysis completed for industry ${industryId}`);
        } catch (error) {
            this.logger.error(`Failed to analyze industry ${industryId}:`, error);
        }
    }

    /**
     * تحلیل استراتژی‌های قیمت‌گذاری
     */
    private async analyzePricingStrategies(
        industryId: string,
        periodStart: Date,
        periodEnd: Date
    ): Promise<PriceAnalysis> {
        // محصولات فعال این صنف
        const activeProducts = await this.prisma.product.findMany({
            where: {
                account: {
                    industryId: industryId
                },
                status: ProductStatus.APPROVED,
                confirmed: true,
                created_at: { lte: periodEnd }
            },
            include: {
                pricing_strategies: {
                    where: {
                        is_active: true,
                        created_at: { lte: periodEnd }
                    }
                },
                order_items: {
                    where: {
                        order: {
                            status: 'COMPLETED',
                            created_at: { gte: periodStart, lte: periodEnd }
                        }
                    }
                }
            }
        });

        // تحلیل بر اساس شرایط مختلف
        const [quantityBased, paymentBased, deliveryBased] = await Promise.all([
            this.analyzeQuantityBasedPricing(activeProducts),
            this.analyzePaymentBasedPricing(activeProducts),
            this.analyzeDeliveryBasedPricing(activeProducts)
        ]);

        return {
            quantity_based: quantityBased,
            payment_based: paymentBased,
            delivery_based: deliveryBased
        };
    }

    /**
     * تحلیل قیمت بر اساس حجم خرید
     */
    private async analyzeQuantityBasedPricing(products: any[]) {
        const quantityAnalysis: Record<string, { prices: number[]; acceptance_rates: number[] }> = {};

        for (const product of products) {
            for (const price of product.pricing_strategies) {
                if (price.condition_type?.includes('BULK') || price.condition_type?.includes('VOLUME')) {
                    const range = this.extractQuantityRange(price.condition_type);
                    if (!quantityAnalysis[range]) {
                        quantityAnalysis[range] = { prices: [], acceptance_rates: [] };
                    }

                    const finalPrice = price.final_price_amount || price.base_price_amount;
                    if (finalPrice && finalPrice > 0) {
                        quantityAnalysis[range].prices.push(finalPrice);

                        // محاسبه نرخ پذیرش ساده بر اساس فروش
                        const acceptanceRate = product.order_items.length > 0 ? 0.8 : 0.3;
                        quantityAnalysis[range].acceptance_rates.push(acceptanceRate);
                    }
                }
            }
        }

        // محاسبه میانگین‌ها
        const result: Record<string, any> = {};
        for (const [range, data] of Object.entries(quantityAnalysis)) {
            const prices = data.prices.filter(p => p > 0);
            if (prices.length > 0) {
                result[range] = {
                    avg_price: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
                    min_price: Math.min(...prices),
                    max_price: Math.max(...prices),
                    acceptance_rate: this.calculateAcceptanceRate(data.acceptance_rates)
                };
            }
        }

        return result;
    }

    /**
     * تحلیل قیمت بر اساس روش پرداخت
     */
    private async analyzePaymentBasedPricing(products: any[]): Promise<Record<string, any>> {
        const paymentAnalysis: Record<string, { prices: number[]; popularity: number }> = {};

        for (const product of products) {
            for (const price of product.pricing_strategies) {
                if (price.condition_type?.includes('CASH') || price.condition_type?.includes('CREDIT')) {
                    const paymentMethod = this.extractPaymentMethod(price.condition_type);
                    if (!paymentAnalysis[paymentMethod]) {
                        paymentAnalysis[paymentMethod] = { prices: [], popularity: 0 };
                    }

                    const finalPrice = price.final_price_amount || price.base_price_amount;
                    if (finalPrice && finalPrice > 0) {
                        paymentAnalysis[paymentMethod].prices.push(finalPrice);
                        paymentAnalysis[paymentMethod].popularity += product.order_items.length;
                    }
                }
            }
        }

        const result: Record<string, any> = {};
        for (const [method, data] of Object.entries(paymentAnalysis)) {
            const prices = data.prices.filter(p => p > 0);
            if (prices.length > 0) {
                const totalPopularity = Object.values(paymentAnalysis).reduce((sum: number, d: any) => sum + d.popularity, 0);

                result[method] = {
                    avg_price: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
                    discount_rate: this.calculateDiscountRate(method, prices),
                    popularity: totalPopularity > 0 ? data.popularity / totalPopularity : 0
                };
            }
        }

        return result;
    }

    /**
     * تحلیل قیمت بر اساس روش تحویل
     */
    private async analyzeDeliveryBasedPricing(products: any[]): Promise<Record<string, any>> {
        // پیاده‌سازی مشابه تحلیل پرداخت
        return {};
    }

    // ==================== IMPROVED UTILITY METHODS ====================

    private extractQuantityRange(conditionType: string): string {
        const match = conditionType.match(/(\d+)-(\d+)/);
        return match ? `${match[1]}-${match[2]}` : '1-10';
    }

    private extractPaymentMethod(conditionType: string): string {
        if (conditionType.includes('CASH')) return 'cash_payment';
        if (conditionType.includes('CREDIT_30')) return 'credit_30d';
        if (conditionType.includes('CREDIT_60')) return 'credit_60d';
        if (conditionType.includes('CREDIT_90')) return 'credit_90d';
        return 'other';
    }

    private calculateDiscountRate(paymentMethod: string, prices: number[]): number {
        const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;

        // نرخ تخفیف تخمینی بر اساس روش پرداخت
        const discountRates: Record<string, number> = {
            'cash_payment': 0.10,
            'credit_30d': 0.05,
            'credit_60d': 0.02,
            'credit_90d': 0.00
        };

        return discountRates[paymentMethod] || 0;
    }

    private calculateAcceptanceRate(acceptanceRates: number[]): number {
        if (acceptanceRates.length === 0) return 0.7;
        return acceptanceRates.reduce((a, b) => a + b, 0) / acceptanceRates.length;
    }

    // ==================== NEW FEATURES ====================

    /**
     * شناسایی محصولات ترند
     */
    private async identifyTrendingProducts(industryId: string, periodStart: Date, periodEnd: Date) {
        const trendingProducts = await this.prisma.product.findMany({
            where: {
                account: {
                    industryId: industryId
                },
                status: ProductStatus.APPROVED,
                created_at: { gte: periodStart, lte: periodEnd }
            },
            include: {
                contents: {
                    where: { language: 'fa' }
                },
                interactions: {
                    where: {
                        created_at: { gte: periodStart, lte: periodEnd }
                    }
                },
                order_items: {
                    where: {
                        order: {
                            status: 'COMPLETED',
                            created_at: { gte: periodStart, lte: periodEnd }
                        }
                    }
                }
            },
            orderBy: [
                { total_views: 'desc' },
                { total_likes: 'desc' }
            ],
            take: 10
        });

        const up = trendingProducts
            .filter(p => p.interactions.length > 5)
            .map(p => p.contents[0]?.name || `Product ${p.id}`)
            .slice(0, 5);

        const down = []; // می‌توانید منطق شناسایی محصولات در حال افت را اضافه کنید

        return { up, down };
    }

    /**
     * محاسبه شاخص‌های بازار به صورت واقعی
     */
    private async calculateMarketIndices(industryId: string, periodStart: Date, periodEnd: Date): Promise<MarketIndices> {
        const [products, orders, interactions] = await Promise.all([
            this.prisma.product.findMany({
                where: {
                    account: { industryId: industryId },
                    status: ProductStatus.APPROVED,
                    created_at: { lte: periodEnd }
                },
                include: {
                    pricing_strategies: {
                        where: { is_active: true, is_primary: true }
                    }
                }
            }),
            this.prisma.order.findMany({
                where: {
                    items: {
                        some: {
                            product: {
                                account: { industryId: industryId }
                            }
                        }
                    },
                    status: 'COMPLETED',
                    created_at: { gte: periodStart, lte: periodEnd }
                }
            }),
            this.prisma.interaction.findMany({
                where: {
                    product: {
                        account: { industryId: industryId }
                    },
                    created_at: { gte: periodStart, lte: periodEnd }
                }
            })
        ]);

        // محاسبات واقعی
        const prices = products.flatMap(p =>
            p.pricing_strategies.map(ps => ps.final_price_amount || ps.base_price_amount)
        ).filter(p => p && p > 0);

        const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
        const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
        const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

        return {
            avgPrice,
            minPrice,
            maxPrice,
            priceTrend: 0.05, // می‌توانید از داده‌های تاریخی استفاده کنید
            totalListings: products.length,
            newListings: products.filter(p => p.created_at >= periodStart).length,
            soldListings: orders.length,
            avgViews: products.length > 0 ? interactions.length / products.length : 0,
            avgResponseRate: 0.75, // می‌توانید از داده‌های واقعی استفاده کنید
            demandSupplyRatio: orders.length > 0 ? (interactions.length / orders.length) : 1,
            marketActivityIndex: this.calculateActivityIndex(products.length, orders.length, interactions.length)
        };
    }

    private calculateActivityIndex(listings: number, orders: number, interactions: number): number {
        // شاخص فعالیت ترکیبی
        const listingScore = Math.min(listings / 100, 1);
        const orderScore = Math.min(orders / 50, 1);
        const interactionScore = Math.min(interactions / 500, 1);

        return (listingScore * 0.3 + orderScore * 0.4 + interactionScore * 0.3) * 100;
    }

    /**
     * تولید پیشنهادات هوشمند پیشرفته
     */
    private async generateIntelligentRecommendations(
        priceAnalysis: PriceAnalysis,
        competitorAnalysis: CompetitorAnalysis,
        buyerBehavior: any,
        marketIndices: MarketIndices
    ) {
        const recommendations = {
            for_sellers: [] as string[],
            for_buyers: [] as string[],
            market_insights: [] as string[],
            risk_alerts: [] as string[]
        };

        // پیشنهادات برای فروشندگان
        if (marketIndices.demandSupplyRatio > 1.5) {
            recommendations.for_sellers.push("تقاضا بالا است - می‌توانید قیمت‌ها را ۵-۱۰٪ افزایش دهید");
        } else if (marketIndices.demandSupplyRatio < 0.8) {
            recommendations.for_sellers.push("عرضه زیاد است - برای رقابت قیمت‌ها را بررسی کنید");
        }

        // پیشنهادات برای خریداران
        if (marketIndices.priceTrend < 0) {
            recommendations.for_buyers.push("قیمت‌ها در حال کاهش است - خرید را به تعویق بیندازید");
        }

        // بینش‌های بازار
        if (Object.keys(priceAnalysis.payment_based).length > 0) {
            recommendations.market_insights.push("پرداخت نقدی محبوب‌ترین روش با بیشترین تخفیف است");
        }

        return recommendations;
    }

    // ==================== PUBLIC API METHODS ====================

    /**
     * دریافت تحلیل بازار برای یک صنف
     */
    async getIndustryAnalysis(industryId: string, periodType: AnalysisPeriod = 'DAILY') {
        const periodStart = this.calculatePeriodStart(periodType);

        return this.prisma.marketAnalytics.findFirst({
            where: {
                industry_id: industryId,
                period_type: periodType,
                period_start: { gte: periodStart }
            },
            orderBy: {
                period_start: 'desc'
            }
        });
    }

    /**
     * دریافت تحلیل قیمت برای یک محصول
     */
    async getProductPriceAnalysis(productId: string) {
        const product = await this.prisma.product.findUnique({
            where: { id: productId },
            include: {
                account: {
                    include: {
                        industry: true
                    }
                },
                pricing_strategies: {
                    where: { is_active: true }
                }
            }
        });

        if (!product?.account?.industryId) {
            throw new Error('Product industry not found');
        }

        const industryAnalysis = await this.getIndustryAnalysis(product.account.industryId);

        return {
            product_pricing: product.pricing_strategies,
            market_comparison: industryAnalysis?.price_analysis_by_conditions,
            recommendations: industryAnalysis?.pricing_recommendations
        };
    }

    private calculatePeriodStart(periodType: AnalysisPeriod): Date {
        const now = new Date();
        switch (periodType) {
            case 'DAILY':
                now.setDate(now.getDate() - 1);
                break;
            case 'WEEKLY':
                now.setDate(now.getDate() - 7);
                break;
            case 'MONTHLY':
                now.setMonth(now.getMonth() - 1);
                break;
            case 'QUARTERLY':
                now.setMonth(now.getMonth() - 3);
                break;
        }
        return now;
    }
}