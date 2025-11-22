import { Injectable, NotFoundException, ConflictException, BadRequestException, Inject } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateIndustryDto } from "./dto/create-industry.dto";
import { UpdateIndustryDto } from "./dto/update-industry.dto";
import { IndustryQueryDto } from "./dto/industry-query.dto";
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Language } from '@prisma/client';
import {I18nInternalServerErrorException} from "../common/exceptions/i18n-exceptions";

export interface IndustryWithRelations {
    id: string;
    business_number?: string;
    industry_branch_id?: string;
    business_type: any[];
    business_tags: string[];
    related_tags: string[];
    buy_products: string[];
    sell_products: string[];
    level: number;
    is_active: boolean;
    priority1: number;
    priority2: number;
    priority3: number;
    account_count: number;
    created_at: Date;
    updated_at: Date;
    parentId?: string;

    // فیلدهای چندزبانه
    name: string;
    description?: string;
    introduction?: string;
    auto_translated?: boolean;

    industry_branch?: any;
    parent?: any;
    children?: any[];
    accounts?: any[];
    as_supplier_relations?: any[];
    as_customer_relations?: any[];
    _count?: {
        accounts: number;
        children: number;
        as_supplier_relations: number;
        as_customer_relations: number;
    };
}

@Injectable()
export class IndustryService {
    constructor(
        private prisma: PrismaService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
    ) {}

    private readonly CACHE_TTL = 5 * 60 * 1000; // 5 دقیقه
    private readonly DEFAULT_LANGUAGE = Language.fa;

    async create(createIndustryDto: CreateIndustryDto) {
        const {
            name,
            description,
            introduction,
            business_tags = [],
            related_tags = [],
            language = this.DEFAULT_LANGUAGE,
            auto_translated = false,
            ...industryData
        } = createIndustryDto;

        // بررسی تکراری نبودن شماره پروانه
        if (industryData.business_number) {
            const existingIndustry = await this.prisma.industry.findFirst({
                where: {
                    business_number: industryData.business_number
                }
            });

            if (existingIndustry) {
                throw new ConflictException("Industry with this business number already exists");
            }
        }

        // بررسی وجود industry_branch اگر ارائه شده
        if (industryData.industry_branch_id) {
            const branch = await this.prisma.industryBranch.findUnique({
                where: { id: industryData.industry_branch_id }
            });

            if (!branch) {
                throw new NotFoundException("Industry branch not found");
            }
        }

        // بررسی وجود parent اگر ارائه شده
        if (industryData.parentId) {
            const parent = await this.prisma.industry.findUnique({
                where: { id: industryData.parentId }
            });

            if (!parent) {
                throw new NotFoundException("Parent industry not found");
            }
        }

        // 🔥 ساخت data object با استفاده از connect برای روابط
        const createData: any = {
            business_number: industryData.business_number,
            business_type: industryData.business_type,
            buy_products: industryData.buy_products || [],
            sell_products: industryData.sell_products || [],
            level: industryData.level || 1,
            priority1: industryData.priority1 || 0,
            priority2: industryData.priority2 || 0,
            priority3: industryData.priority3 || 0,
            is_active: industryData.is_active !== undefined ? industryData.is_active : true,
            account_count: 0,
            contents: {
                create: {
                    language,
                    name,
                    description,
                    introduction,
                    business_tags, // انتقال به IndustryContent
                    related_tags, // انتقال به IndustryContent
                    auto_translated
                }
            }
        };

        // 🔥 اضافه کردن روابط با connect
        if (industryData.industry_branch_id) {
            createData.industry_branch = {
                connect: { id: industryData.industry_branch_id }
            };
        }

        if (industryData.parentId) {
            createData.parent = {
                connect: { id: industryData.parentId }
            };
        }

        const industry = await this.prisma.industry.create({
            data: createData,
            include: {
                industry_branch: {
                    include: {
                        contents: {
                            where: { language }
                        }
                    }
                },
                parent: {
                    include: {
                        contents: {
                            where: { language }
                        }
                    }
                },
                children: {
                    take: 5,
                    include: {
                        contents: {
                            where: { language }
                        }
                    }
                },
                contents: {
                    where: { language }
                },
                _count: {
                    select: {
                        accounts: true,
                        children: true,
                        as_supplier_relations: true,
                        as_customer_relations: true
                    }
                }
            }
        });

        await this.clearIndustriesCache();
        return this.formatIndustryResponse(industry);
    }

    async fastFind(search: string, language: Language = this.DEFAULT_LANGUAGE, page: number = 1, limit: number = 20) {
        const cacheKey = `industries_fast:${search}:${language}:${page}:${limit}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        const skip = (page - 1) * limit;

        try {
            // شرط جستجو - اگر search خالی است، همه رکوردها را برگردان
            const whereCondition: any = {
                language
            };

            if (search && search.trim() !== '') {
                whereCondition.name = {
                    contains: search,
                    mode: 'insensitive'
                };
            }

            // استفاده مستقیم از IndustryContent برای سرعت بیشتر
            const [industryContents, total] = await Promise.all([
                this.prisma.industryContent.findMany({
                    where: whereCondition,
                    skip,
                    take: limit,
                    select: {
                        industry_id: true,
                        name: true
                    },
                    orderBy: {
                        name: 'asc'
                    }
                }),
                this.prisma.industryContent.count({
                    where: whereCondition
                })
            ]);

            // فرمت ساده شده
            const formattedIndustries = industryContents.map(content => ({
                id: content.industry_id,
                name: content.name
            }));

            const result = {
                data: formattedIndustries,
                meta: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                }
            };

            await this.cacheManager.set(cacheKey, result, 2 * 60 * 1000);

            return result;

        } catch (error) {
            console.error('Fast find industries error:', error);
            throw new I18nInternalServerErrorException('INDUSTRIES_FAST_FETCH_ERROR', language);
        }
    }

    async findAll(query: IndustryQueryDto = {}) {
        const {
            page = 1,
            limit = 10,
            search,
            branch,
            sub_branch,
            business_type,
            is_active,
            level,
            industry_branch_id,
            parentId,
            with_relations = false,
            with_accounts = false,
            sortBy = 'created_at',
            sortOrder = 'desc',
            language = this.DEFAULT_LANGUAGE
        } = query;

        const cacheKey = this.getIndustriesCacheKey(query);
        const skip = (page - 1) * limit;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        const where: any = {};

        if (search) {
            where.OR = [
                {
                    contents: {
                        some: {
                            language,
                            OR: [
                                { name: { contains: search, mode: 'insensitive' } },
                                { description: { contains: search, mode: 'insensitive' } },
                                { introduction: { contains: search, mode: 'insensitive' } },
                                { business_tags: { has: search } }, // جستجو در business_tags مربوط به IndustryContent
                                { related_tags: { has: search } } // جستجو در related_tags مربوط به IndustryContent
                            ]
                        }
                    }
                },
                { business_number: { contains: search, mode: 'insensitive' } },
                { buy_products: { has: search } },
                { sell_products: { has: search } }
            ];
        }

        if (is_active !== undefined) {
            where.is_active = is_active;
        }

        if (level !== undefined) {
            where.level = level;
        }

        if (business_type) {
            where.business_type = { has: business_type };
        }

        if (industry_branch_id) {
            where.industry_branch_id = industry_branch_id;
        }

        if (parentId) {
            where.parentId = parentId;
        }

        // فیلتر بر اساس شاخه
        if (branch || sub_branch) {
            where.industry_branch = {
                contents: {
                    some: {
                        language,
                        OR: [
                            { name: { contains: branch, mode: 'insensitive' } },
                            { name: { contains: sub_branch, mode: 'insensitive' } }
                        ]
                    }
                }
            };
        }

        // شامل کردن relations و accounts اگر درخواست شده
        const include: any = {
            industry_branch: {
                include: {
                    contents: {
                        where: { language }
                    }
                }
            },
            parent: {
                include: {
                    contents: {
                        where: { language }
                    }
                }
            },
            contents: {
                where: { language }
            },
            _count: {
                select: {
                    accounts: true,
                    children: true,
                    as_supplier_relations: true,
                    as_customer_relations: true
                }
            }
        };

        if (with_relations) {
            include.as_supplier_relations = {
                include: {
                    customer_industry: {
                        include: {
                            contents: {
                                where: { language }
                            },
                            industry_branch: {
                                include: {
                                    contents: {
                                        where: { language }
                                    }
                                }
                            }
                        }
                    }
                },
                take: 5
            };
            include.as_customer_relations = {
                include: {
                    supplier_industry: {
                        include: {
                            contents: {
                                where: { language }
                            },
                            industry_branch: {
                                include: {
                                    contents: {
                                        where: { language }
                                    }
                                }
                            }
                        }
                    }
                },
                take: 5
            };
        }

        if (with_accounts) {
            include.accounts = {
                take: 5,
                select: {
                    id: true,
                    name: true,
                    activity_type: true,
                    is_active: true,
                    confirmed: true
                }
            };
        }

        const industries = await this.prisma.industry.findMany({
            where,
            skip,
            take: limit,
            include,
        });

        // 🔥 مرتب‌سازی دستی با type assertion
        let sortedIndustries = industries;
        if (sortBy === 'name') {
            sortedIndustries = industries.sort((a, b) => {
                const aContent = a.contents[0] as { name?: string } | undefined;
                const bContent = b.contents[0] as { name?: string } | undefined;
                const aName = aContent?.name || '';
                const bName = bContent?.name || '';
                const comparison = aName.localeCompare(bName, 'fa');
                return sortOrder === 'asc' ? comparison : -comparison;
            });
        } else {
            sortedIndustries = industries.sort((a, b) => {
                const aValue = a[sortBy as keyof typeof a];
                const bValue = b[sortBy as keyof typeof b];
                const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
                return sortOrder === 'asc' ? comparison : -comparison;
            });
        }

        const total = await this.prisma.industry.count({ where });

        const formattedIndustries = sortedIndustries.map(industry => this.formatIndustryResponse(industry));

        const result = {
            data: formattedIndustries,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            }
        };

        await this.cacheManager.set(cacheKey, result, this.CACHE_TTL);
        return result;
    }

    async findById(id: string, includeRelations: boolean = false, language: Language = this.DEFAULT_LANGUAGE): Promise<IndustryWithRelations> {
        const cacheKey = `industry:${id}:${includeRelations}:${language}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached as IndustryWithRelations;
        }

        const include: any = {
            industry_branch: {
                include: {
                    contents: {
                        where: { language }
                    }
                }
            },
            parent: {
                include: {
                    contents: {
                        where: { language }
                    }
                }
            },
            children: {
                include: {
                    contents: {
                        where: { language }
                    },
                    _count: {
                        select: {
                            accounts: true
                        }
                    }
                }
            },
            accounts: {
                take: 10,
                select: {
                    id: true,
                    name: true,
                    activity_type: true,
                    is_active: true,
                    confirmed: true,
                    created_at: true
                }
            },
            contents: {
                where: { language }
            },
            _count: {
                select: {
                    accounts: true,
                    children: true,
                    as_supplier_relations: true,
                    as_customer_relations: true
                }
            }
        };

        if (includeRelations) {
            include.as_supplier_relations = {
                include: {
                    customer_industry: {
                        include: {
                            contents: {
                                where: { language }
                            },
                            industry_branch: {
                                include: {
                                    contents: {
                                        where: { language }
                                    }
                                }
                            },
                            _count: {
                                select: {
                                    accounts: true
                                }
                            }
                        }
                    }
                }
            };
            include.as_customer_relations = {
                include: {
                    supplier_industry: {
                        include: {
                            contents: {
                                where: { language }
                            },
                            industry_branch: {
                                include: {
                                    contents: {
                                        where: { language }
                                    }
                                }
                            },
                            _count: {
                                select: {
                                    accounts: true
                                }
                            }
                        }
                    }
                }
            };
        }

        const industry = await this.prisma.industry.findUnique({
            where: { id },
            include
        });

        if (!industry) {
            throw new NotFoundException("Industry not found");
        }

        const formattedIndustry = this.formatIndustryResponse(industry);
        await this.cacheManager.set(cacheKey, formattedIndustry, this.CACHE_TTL);
        return formattedIndustry as IndustryWithRelations;
    }

    async findByBusinessNumber(business_number: string, language: Language = this.DEFAULT_LANGUAGE) {
        const cacheKey = `industry:business_number:${business_number}:${language}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        const industry = await this.prisma.industry.findFirst({
            where: { business_number },
            include: {
                industry_branch: {
                    include: {
                        contents: {
                            where: { language }
                        }
                    }
                },
                contents: {
                    where: { language }
                },
                _count: {
                    select: {
                        accounts: true
                    }
                }
            }
        });

        if (!industry) {
            return null;
        }

        const formattedIndustry = this.formatIndustryResponse(industry);
        await this.cacheManager.set(cacheKey, formattedIndustry, this.CACHE_TTL);
        return formattedIndustry;
    }

    async update(id: string, updateIndustryDto: UpdateIndustryDto, language: Language = this.DEFAULT_LANGUAGE) {
        const existingIndustry = await this.prisma.industry.findUnique({
            where: { id },
            include: {
                contents: {
                    where: { language }
                }
            }
        });

        if (!existingIndustry) {
            throw new NotFoundException("Industry not found");
        }

        const { name, description, introduction, business_tags, related_tags, ...industryData } = updateIndustryDto;

        // بررسی تکراری نبودن شماره پروانه
        if (industryData.business_number && industryData.business_number !== existingIndustry.business_number) {
            const duplicateIndustry = await this.prisma.industry.findFirst({
                where: {
                    business_number: industryData.business_number,
                    id: { not: id }
                }
            });

            if (duplicateIndustry) {
                throw new ConflictException("Industry with this business number already exists");
            }
        }

        // بررسی وجود industry_branch اگر ارائه شده
        if (industryData.industry_branch_id) {
            const branch = await this.prisma.industryBranch.findUnique({
                where: { id: industryData.industry_branch_id }
            });

            if (!branch) {
                throw new NotFoundException("Industry branch not found");
            }
        }

        // بررسی وجود parent اگر ارائه شده
        if (industryData.parentId) {
            if (industryData.parentId === id) {
                throw new BadRequestException("Industry cannot be its own parent");
            }

            const parent = await this.prisma.industry.findUnique({
                where: { id: industryData.parentId }
            });

            if (!parent) {
                throw new NotFoundException("Parent industry not found");
            }
        }

        const contentUpdateData: any = {};
        if (name !== undefined) contentUpdateData.name = name;
        if (description !== undefined) contentUpdateData.description = description;
        if (introduction !== undefined) contentUpdateData.introduction = introduction;
        if (business_tags !== undefined) contentUpdateData.business_tags = business_tags;
        if (related_tags !== undefined) contentUpdateData.related_tags = related_tags;

        const updatedIndustry = await this.prisma.industry.update({
            where: { id },
            data: {
                ...industryData,
                contents: {
                    upsert: {
                        where: {
                            industry_id_language: {
                                industry_id: id,
                                language: language
                            }
                        },
                        create: {
                            language,
                            ...contentUpdateData
                        },
                        update: contentUpdateData
                    }
                }
            },
            include: {
                industry_branch: {
                    include: {
                        contents: {
                            where: { language }
                        }
                    }
                },
                parent: {
                    include: {
                        contents: {
                            where: { language }
                        }
                    }
                },
                contents: {
                    where: { language }
                },
                _count: {
                    select: {
                        accounts: true,
                        children: true
                    }
                }
            }
        });

        await this.clearIndustryCache(id, existingIndustry.business_number, language);
        return this.formatIndustryResponse(updatedIndustry);
    }

    async remove(id: string) {
        const industry = await this.prisma.industry.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        accounts: true,
                        children: true
                    }
                }
            }
        });

        if (!industry) {
            throw new NotFoundException("Industry not found");
        }

        // بررسی وجود حساب‌های مرتبط
        if (industry._count.accounts > 0) {
            throw new BadRequestException("Cannot delete industry with associated accounts");
        }

        // بررسی وجود زیرشاخه‌ها
        if (industry._count.children > 0) {
            throw new BadRequestException("Cannot delete industry with children. Delete children first.");
        }

        await this.prisma.industry.delete({
            where: { id },
        });

        await this.clearIndustryCache(id, industry.business_number);
        return { message: "Industry deleted successfully" };
    }

    async toggleStatus(id: string, language: Language = this.DEFAULT_LANGUAGE) {
        const industry = await this.prisma.industry.findUnique({
            where: { id },
            include: {
                contents: {
                    where: { language }
                }
            }
        });

        if (!industry) {
            throw new NotFoundException("Industry not found");
        }

        const updatedIndustry = await this.prisma.industry.update({
            where: { id },
            data: { is_active: !industry.is_active },
            include: {
                industry_branch: {
                    include: {
                        contents: {
                            where: { language }
                        }
                    }
                },
                contents: {
                    where: { language }
                },
                _count: {
                    select: {
                        accounts: true
                    }
                }
            }
        });

        await this.clearIndustryCache(id, industry.business_number, language);
        return this.formatIndustryResponse(updatedIndustry);
    }

    async getIndustryStats(language: Language = this.DEFAULT_LANGUAGE) {
        const cacheKey = `industry:stats:${language}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        const [
            totalIndustries,
            activeIndustries,
            industriesWithAccounts,
            industriesWithRelations,
            recentIndustries,
            level1Industries,
            level2Industries,
            level3Industries,
            level4Industries,
        ] = await Promise.all([
            this.prisma.industry.count(),
            this.prisma.industry.count({ where: { is_active: true } }),
            this.prisma.industry.count({
                where: {
                    accounts: { some: {} }
                }
            }),
            this.prisma.industry.count({
                where: {
                    OR: [
                        { as_supplier_relations: { some: {} } },
                        { as_customer_relations: { some: {} } }
                    ]
                }
            }),
            this.prisma.industry.count({
                where: {
                    created_at: {
                        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                    }
                }
            }),
            this.prisma.industry.count({ where: { level: 1 } }),
            this.prisma.industry.count({ where: { level: 2 } }),
            this.prisma.industry.count({ where: { level: 3 } }),
            this.prisma.industry.count({ where: { level: 4 } }),
        ]);

        const stats = {
            totalIndustries,
            activeIndustries,
            industriesWithAccounts,
            industriesWithRelations,
            recentIndustries,
            level1Industries,
            level2Industries,
            level3Industries,
            level4Industries,
            industriesWithoutAccounts: totalIndustries - industriesWithAccounts,
            inactiveIndustries: totalIndustries - activeIndustries,
        };

        await this.cacheManager.set(cacheKey, stats, this.CACHE_TTL);
        return stats;
    }

    async searchIndustries(query: string, limit: number = 10, language: Language = this.DEFAULT_LANGUAGE) {
        const cacheKey = `industry:search:${query}:${limit}:${language}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        const industries = await this.prisma.industry.findMany({
            where: {
                OR: [
                    {
                        contents: {
                            some: {
                                language,
                                OR: [
                                    { name: { contains: query, mode: 'insensitive' } },
                                    { description: { contains: query, mode: 'insensitive' } },
                                    { introduction: { contains: query, mode: 'insensitive' } },
                                    { business_tags: { has: query } }, // جستجو در business_tags مربوط به IndustryContent
                                    { related_tags: { has: query } } // جستجو در related_tags مربوط به IndustryContent
                                ]
                            }
                        }
                    },
                    { business_number: { contains: query, mode: 'insensitive' } },
                    { buy_products: { has: query } },
                    { sell_products: { has: query } }
                ],
                is_active: true
            },
            include: {
                industry_branch: {
                    include: {
                        contents: {
                            where: { language }
                        }
                    }
                },
                contents: {
                    where: { language }
                },
                _count: {
                    select: {
                        accounts: true
                    }
                }
            },
            take: limit
        });

        // مرتب‌سازی دستی بر اساس relevance
        const sortedIndustries = industries.sort((a, b) => {
            const scoreA = this.calculateRelevanceScore(a, query, language);
            const scoreB = this.calculateRelevanceScore(b, query, language);
            return scoreB - scoreA;
        });

        const formattedIndustries = sortedIndustries.map(industry => this.formatIndustryResponse(industry));
        await this.cacheManager.set(cacheKey, formattedIndustries, this.CACHE_TTL);
        return formattedIndustries;
    }

    private calculateRelevanceScore(industry: any, query: string, language: Language): number {
        let score = 0;
        const lowerQuery = query.toLowerCase();
        const content = industry.contents?.find((c: any) => c.language === language) || industry.contents?.[0] || {};

        // نام دقیقاً مطابقت دارد (بالاترین امتیاز)
        if (content.name?.toLowerCase() === lowerQuery) {
            score += 100;
        }

        // نام شامل کلمه جستجو است
        if (content.name?.toLowerCase().includes(lowerQuery)) {
            score += 50;
        }

        // توضیح شامل کلمه جستجو است
        if (content.description?.toLowerCase().includes(lowerQuery)) {
            score += 30;
        }

        // معرفی شامل کلمه جستجو است
        if (content.introduction?.toLowerCase().includes(lowerQuery)) {
            score += 25;
        }

        // تگ‌های کسب‌وکار شامل کلمه جستجو است
        if (content.business_tags?.some((tag: string) => tag.toLowerCase().includes(lowerQuery))) {
            score += 20;
        }

        // تگ‌های مرتبط شامل کلمه جستجو است
        if (content.related_tags?.some((tag: string) => tag.toLowerCase().includes(lowerQuery))) {
            score += 15;
        }

        // محصولات خرید شامل کلمه جستجو است
        if (industry.buy_products.some((product: string) => product.toLowerCase().includes(lowerQuery))) {
            score += 10;
        }

        // محصولات فروش شامل کلمه جستجو است
        if (industry.sell_products.some((product: string) => product.toLowerCase().includes(lowerQuery))) {
            score += 10;
        }

        // امتیاز بر اساس تعداد حساب‌ها (محبوبیت)
        score += Math.min(industry._count.accounts, 10);

        return score;
    }

    async getIndustriesByBranch(branchId: string, query: IndustryQueryDto = {}, language: Language = this.DEFAULT_LANGUAGE) {
        const cacheKey = `industry:branch:${branchId}:${JSON.stringify(query)}:${language}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        // بررسی وجود branch
        const branch = await this.prisma.industryBranch.findUnique({
            where: { id: branchId }
        });

        if (!branch) {
            throw new NotFoundException("Industry branch not found");
        }

        query.industry_branch_id = branchId;
        const result = await this.findAll({ ...query, language });

        await this.cacheManager.set(cacheKey, result, this.CACHE_TTL);
        return result;
    }

    async getIndustryTree(parentId: string = null, language: Language = this.DEFAULT_LANGUAGE) {
        const cacheKey = `industry:tree:${parentId || 'root'}:${language}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        const industries = await this.prisma.industry.findMany({
            where: { parentId },
            include: {
                industry_branch: {
                    include: {
                        contents: {
                            where: { language }
                        }
                    }
                },
                children: {
                    include: {
                        children: {
                            include: {
                                contents: {
                                    where: { language }
                                },
                                _count: {
                                    select: {
                                        accounts: true
                                    }
                                }
                            }
                        },
                        contents: {
                            where: { language }
                        },
                        _count: {
                            select: {
                                accounts: true,
                                children: true
                            }
                        }
                    }
                },
                contents: {
                    where: { language }
                },
                _count: {
                    select: {
                        accounts: true,
                        children: true
                    }
                }
            }
        });

        // مرتب‌سازی دستی بر اساس نام
        const sortedIndustries = industries.sort((a, b) => {
            const aName = a.contents[0]?.name || '';
            const bName = b.contents[0]?.name || '';
            return aName.localeCompare(bName, 'fa');
        });

        const formattedIndustries = sortedIndustries.map(industry => this.formatIndustryResponse(industry));
        await this.cacheManager.set(cacheKey, formattedIndustries, this.CACHE_TTL);
        return formattedIndustries;
    }

    async getPopularIndustries(limit: number = 10, language: Language = this.DEFAULT_LANGUAGE) {
        const cacheKey = `industry:popular:${limit}:${language}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        const industries = await this.prisma.industry.findMany({
            where: {
                is_active: true,
                account_count: { gt: 0 }
            },
            include: {
                industry_branch: {
                    include: {
                        contents: {
                            where: { language }
                        }
                    }
                },
                contents: {
                    where: { language }
                },
                _count: {
                    select: {
                        accounts: true
                    }
                }
            },
            orderBy: {
                account_count: 'desc'
            },
            take: limit
        });

        const formattedIndustries = industries.map(industry => this.formatIndustryResponse(industry));
        await this.cacheManager.set(cacheKey, formattedIndustries, this.CACHE_TTL);
        return formattedIndustries;
    }

    // ==================== Public Methods ====================

    async getPublicIndustries(query: IndustryQueryDto = {}) {
        // فقط صنف‌های فعال
        query.is_active = true;
        return this.findAll(query);
    }

    async getPublicIndustry(id: string, language: Language = this.DEFAULT_LANGUAGE) {
        return await this.findById(id, false, language) as IndustryWithRelations;
    }

    // ==================== Helper Methods ====================

    private formatIndustryResponse(industry: any) {
        const content = industry.contents?.[0] || {};

        return {
            id: industry.id,
            business_number: industry.business_number,
            industry_branch_id: industry.industry_branch_id,
            business_type: industry.business_type,
            business_tags: content.business_tags || [], // حالا از content میاد
            related_tags: content.related_tags || [], // حالا از content میاد
            buy_products: industry.buy_products,
            sell_products: industry.sell_products,
            level: industry.level,
            is_active: industry.is_active,
            priority1: industry.priority1,
            priority2: industry.priority2,
            priority3: industry.priority3,
            account_count: industry.account_count,
            created_at: industry.created_at,
            updated_at: industry.updated_at,
            parentId: industry.parentId,

            // فیلدهای چندزبانه
            name: content.name,
            description: content.description,
            introduction: content.introduction,
            auto_translated: content.auto_translated,

            // روابط
            industry_branch: industry.industry_branch ? this.formatBranchResponse(industry.industry_branch) : null,
            parent: industry.parent ? this.formatIndustryResponse(industry.parent) : null,
            children: industry.children?.map((child: any) => this.formatIndustryResponse(child)) || [],
            accounts: industry.accounts || [],
            as_supplier_relations: industry.as_supplier_relations || [],
            as_customer_relations: industry.as_customer_relations || [],

            // آمار
            _count: industry._count
        };
    }

    private formatBranchResponse(branch: any) {
        const content = branch.contents?.[0] || {};
        return {
            id: branch.id,
            code: branch.code,
            level: branch.level,
            name: content.name,
            description: content.description,
            department: content.department
        };
    }

    // ==================== Cache Methods ====================

    private getIndustriesCacheKey(query: IndustryQueryDto): string {
        return `industries:${JSON.stringify(query)}`;
    }

    private async clearIndustryCache(id: string, business_number?: string, language?: Language) {
        const cacheKeys = [
            `industry:${id}`,
            `industry:${id}:true`,
            `industry:${id}:false`,
            `industry:${id}:true:${language || this.DEFAULT_LANGUAGE}`,
            `industry:${id}:false:${language || this.DEFAULT_LANGUAGE}`,
            'industry:stats',
            'industry:popular:10',
            'industry:tree:root'
        ];

        if (business_number) {
            cacheKeys.push(`industry:business_number:${business_number}`);
            cacheKeys.push(`industry:business_number:${business_number}:${language || this.DEFAULT_LANGUAGE}`);
        }

        await Promise.all(cacheKeys.map(key => this.cacheManager.del(key)));
        await this.clearIndustriesCache();
    }

    private async clearIndustriesCache() {
        try {
            const knownKeys = [
                'industry:stats',
                'industry:popular:10',
                'industry:tree:root'
            ];

            await Promise.all(knownKeys.map(key => this.cacheManager.del(key)));
        } catch (error) {
            console.error('Error clearing industries cache:', error);
        }
    }
}