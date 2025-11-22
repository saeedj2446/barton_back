import { Injectable, NotFoundException, ConflictException, BadRequestException, Inject } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateIndustryRelationDto } from "./dto/create-industry-relation.dto";
import { UpdateIndustryRelationDto } from "./dto/update-industry-relation.dto";
import { IndustryRelationQueryDto } from "./dto/industry-relation-query.dto";
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Language } from '@prisma/client';

@Injectable()
export class IndustryRelationService {
    constructor(
        private prisma: PrismaService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
    ) {}

    private readonly CACHE_TTL = 10 * 60 * 1000; // 10 دقیقه
    private readonly DEFAULT_LANGUAGE = Language.fa;

    async create(createIndustryRelationDto: CreateIndustryRelationDto, language: Language = this.DEFAULT_LANGUAGE) {
        // بررسی وجود صنف‌ها
        const [supplier, customer] = await Promise.all([
            this.prisma.industry.findUnique({
                where: { id: createIndustryRelationDto.supplier_industry_id },
                include: {
                    contents: {
                        where: { language }
                    }
                }
            }),
            this.prisma.industry.findUnique({
                where: { id: createIndustryRelationDto.customer_industry_id },
                include: {
                    contents: {
                        where: { language }
                    }
                }
            })
        ]);

        if (!supplier) {
            throw new NotFoundException("Supplier industry not found");
        }
        if (!customer) {
            throw new NotFoundException("Customer industry not found");
        }

        // بررسی نبودن رابطه تکراری
        const existingRelation = await this.prisma.industryRelation.findUnique({
            where: {
                supplier_industry_id_customer_industry_id: {
                    supplier_industry_id: createIndustryRelationDto.supplier_industry_id,
                    customer_industry_id: createIndustryRelationDto.customer_industry_id
                }
            }
        });

        if (existingRelation) {
            throw new ConflictException("Industry relation already exists between these industries");
        }

        // بررسی نبودن رابطه معکوس
        const reverseRelation = await this.prisma.industryRelation.findUnique({
            where: {
                supplier_industry_id_customer_industry_id: {
                    supplier_industry_id: createIndustryRelationDto.customer_industry_id,
                    customer_industry_id: createIndustryRelationDto.supplier_industry_id
                }
            }
        });

        if (reverseRelation) {
            throw new ConflictException("Reverse industry relation already exists");
        }

        const relation = await this.prisma.industryRelation.create({
            data: createIndustryRelationDto,
            include: {
                supplier_industry: {
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
                        }
                    }
                },
                customer_industry: {
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
                        }
                    }
                }
            }
        });

        await this.clearRelationsCache();
        return this.formatRelationResponse(relation);
    }

    async findAll(query: IndustryRelationQueryDto = {}, language: Language = this.DEFAULT_LANGUAGE) {
        const {
            page = 1,
            limit = 50,
            supplier_industry_id,
            customer_industry_id,
            relation_type,
            min_strength,
            max_strength,
            sortBy = 'created_at',
            sortOrder = 'desc'
        } = query;

        const cacheKey = this.getRelationsCacheKey(query);
        const skip = (page - 1) * limit;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        const where: any = {};

        if (supplier_industry_id) {
            where.supplier_industry_id = supplier_industry_id;
        }

        if (customer_industry_id) {
            where.customer_industry_id = customer_industry_id;
        }

        if (relation_type) {
            where.relation_type = relation_type;
        }

        if (min_strength !== undefined || max_strength !== undefined) {
            where.strength = {};
            if (min_strength !== undefined) {
                where.strength.gte = min_strength;
            }
            if (max_strength !== undefined) {
                where.strength.lte = max_strength;
            }
        }

        const orderBy: any = {};
        orderBy[sortBy] = sortOrder;

        const [relations, total] = await Promise.all([
            this.prisma.industryRelation.findMany({
                where,
                skip,
                take: limit,
                include: {
                    supplier_industry: {
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
                    },
                    customer_industry: {
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
                    }
                },
                orderBy,
            }),
            this.prisma.industryRelation.count({ where })
        ]);

        const formattedRelations = relations.map(relation => this.formatRelationResponse(relation));

        const result = {
            data: formattedRelations,
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

    async findById(id: string, language: Language = this.DEFAULT_LANGUAGE) {
        const cacheKey = `industry-relation:${id}:${language}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        const relation = await this.prisma.industryRelation.findUnique({
            where: { id },
            include: {
                supplier_industry: {
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
                },
                customer_industry: {
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
                }
            }
        });

        if (!relation) {
            throw new NotFoundException("Industry relation not found");
        }

        const formattedRelation = this.formatRelationResponse(relation);
        await this.cacheManager.set(cacheKey, formattedRelation, this.CACHE_TTL);
        return formattedRelation;
    }

    async update(id: string, updateIndustryRelationDto: UpdateIndustryRelationDto, language: Language = this.DEFAULT_LANGUAGE) {
        const existingRelation = await this.prisma.industryRelation.findUnique({
            where: { id }
        });

        if (!existingRelation) {
            throw new NotFoundException("Industry relation not found");
        }

        // اگر supplier یا customer تغییر کرده، بررسی تکراری بودن
        if (updateIndustryRelationDto.supplier_industry_id || updateIndustryRelationDto.customer_industry_id) {
            const supplierId = updateIndustryRelationDto.supplier_industry_id || existingRelation.supplier_industry_id;
            const customerId = updateIndustryRelationDto.customer_industry_id || existingRelation.customer_industry_id;

            // بررسی وجود صنف‌ها
            const [supplier, customer] = await Promise.all([
                this.prisma.industry.findUnique({ where: { id: supplierId } }),
                this.prisma.industry.findUnique({ where: { id: customerId } })
            ]);

            if (!supplier || !customer) {
                throw new NotFoundException("Supplier or customer industry not found");
            }

            // بررسی تکراری بودن (به جز خود رابطه فعلی)
            if (supplierId !== existingRelation.supplier_industry_id || customerId !== existingRelation.customer_industry_id) {
                const duplicateRelation = await this.prisma.industryRelation.findUnique({
                    where: {
                        supplier_industry_id_customer_industry_id: {
                            supplier_industry_id: supplierId,
                            customer_industry_id: customerId
                        }
                    }
                });

                if (duplicateRelation && duplicateRelation.id !== id) {
                    throw new ConflictException("Industry relation already exists between these industries");
                }
            }
        }

        const updatedRelation = await this.prisma.industryRelation.update({
            where: { id },
            data: updateIndustryRelationDto,
            include: {
                supplier_industry: {
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
                        }
                    }
                },
                customer_industry: {
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
                        }
                    }
                }
            }
        });

        await this.clearRelationCache(id, language);
        return this.formatRelationResponse(updatedRelation);
    }

    async remove(id: string) {
        const relation = await this.prisma.industryRelation.findUnique({
            where: { id }
        });

        if (!relation) {
            throw new NotFoundException("Industry relation not found");
        }

        await this.prisma.industryRelation.delete({
            where: { id },
        });

        await this.clearRelationCache(id);
        return { message: "Industry relation deleted successfully" };
    }

    // ==================== متدهای خاص ====================

    async getIndustryRelations(industryId: string, type: 'supplier' | 'customer' | 'both' = 'both', language: Language = this.DEFAULT_LANGUAGE) {
        const cacheKey = `industry-relations:${industryId}:${type}:${language}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        let where: any = {};

        if (type === 'supplier') {
            where.supplier_industry_id = industryId;
        } else if (type === 'customer') {
            where.customer_industry_id = industryId;
        } else {
            where.OR = [
                { supplier_industry_id: industryId },
                { customer_industry_id: industryId }
            ];
        }

        const relations = await this.prisma.industryRelation.findMany({
            where,
            include: {
                supplier_industry: {
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
                },
                customer_industry: {
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
                }
            },
            orderBy: { strength: 'desc' }
        });

        const formattedRelations = relations.map(relation => this.formatRelationResponse(relation));
        await this.cacheManager.set(cacheKey, formattedRelations, this.CACHE_TTL);
        return formattedRelations;
    }

    async getRelationStats(language: Language = this.DEFAULT_LANGUAGE) {
        const cacheKey = `industry-relation:stats:${language}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        const [
            totalRelations,
            directSupplyRelations,
            complementaryRelations,
            potentialRelations,
            strongRelations,
            recentRelations,
        ] = await Promise.all([
            this.prisma.industryRelation.count(),
            this.prisma.industryRelation.count({ where: { relation_type: 'DIRECT_SUPPLY' } }),
            this.prisma.industryRelation.count({ where: { relation_type: 'COMPLEMENTARY' } }),
            this.prisma.industryRelation.count({ where: { relation_type: 'POTENTIAL' } }),
            this.prisma.industryRelation.count({ where: { strength: { gte: 0.7 } } }),
            this.prisma.industryRelation.count({
                where: {
                    created_at: {
                        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                    }
                }
            }),
        ]);

        const stats = {
            totalRelations,
            directSupplyRelations,
            complementaryRelations,
            potentialRelations,
            strongRelations,
            recentRelations,
            weakRelations: totalRelations - strongRelations,
        };

        await this.cacheManager.set(cacheKey, stats, this.CACHE_TTL);
        return stats;
    }

    async findRelatedIndustries(industryId: string, limit: number = 10, language: Language = this.DEFAULT_LANGUAGE) {
        const cacheKey = `industry-related:${industryId}:${limit}:${language}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        // پیدا کردن صنف‌های مرتبط (هم به عنوان supplier و هم customer)
        const [asSupplier, asCustomer] = await Promise.all([
            this.prisma.industryRelation.findMany({
                where: { supplier_industry_id: industryId },
                include: {
                    customer_industry: {
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
                    }
                },
                orderBy: { strength: 'desc' },
                take: limit
            }),
            this.prisma.industryRelation.findMany({
                where: { customer_industry_id: industryId },
                include: {
                    supplier_industry: {
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
                    }
                },
                orderBy: { strength: 'desc' },
                take: limit
            })
        ]);

        const relatedIndustries = [
            ...asSupplier.map(rel => ({
                industry: this.formatIndustryResponse(rel.customer_industry),
                relation_type: rel.relation_type,
                strength: rel.strength,
                direction: 'supplier_to_customer' as const
            })),
            ...asCustomer.map(rel => ({
                industry: this.formatIndustryResponse(rel.supplier_industry),
                relation_type: rel.relation_type,
                strength: rel.strength,
                direction: 'customer_to_supplier' as const
            }))
        ].sort((a, b) => b.strength - a.strength).slice(0, limit);

        await this.cacheManager.set(cacheKey, relatedIndustries, this.CACHE_TTL);
        return relatedIndustries;
    }

    async suggestRelations(industryId: string, limit: number = 5, language: Language = this.DEFAULT_LANGUAGE) {
        const industry = await this.prisma.industry.findUnique({
            where: { id: industryId },
            include: {
                contents: {
                    where: { language }
                }
            }
        });

        if (!industry) {
            throw new NotFoundException("Industry not found");
        }

        // گرفتن تگ‌های صنف از محتوا
        const industryTags = industry.contents[0]?.business_tags || [];

        // پیدا کردن صنف‌های مشابه بر اساس تگ‌ها و شاخه
        const similarIndustries = await this.prisma.industry.findMany({
            where: {
                AND: [
                    { id: { not: industryId } },
                    {
                        OR: [
                            // جستجو در business_tags مربوط به IndustryContent
                            {
                                contents: {
                                    some: {
                                        language,
                                        business_tags: { hasSome: industryTags }
                                    }
                                }
                            },
                            { industry_branch_id: industry.industry_branch_id }
                        ]
                    }
                ]
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
            take: limit * 2 // بیشتر بگیر تا بعد فیلتر کنیم
        });

        // فیلتر کردن صنف‌هایی که قبلاً رابطه دارند
        const existingRelations = await this.prisma.industryRelation.findMany({
            where: {
                OR: [
                    { supplier_industry_id: industryId },
                    { customer_industry_id: industryId }
                ]
            }
        });

        const existingIndustryIds = new Set(
            existingRelations.flatMap(rel => [
                rel.supplier_industry_id,
                rel.customer_industry_id
            ])
        );

        const suggestions = similarIndustries
            .filter(ind => !existingIndustryIds.has(ind.id))
            .slice(0, limit)
            .map(ind => ({
                industry: this.formatIndustryResponse(ind),
                similarity_score: this.calculateSimilarity(industry, ind),
                suggested_relation: 'POTENTIAL' as const
            }));

        return suggestions;
    }

    private calculateSimilarity(industry1: any, industry2: any): number {
        let score = 0;

        // گرفتن تگ‌ها از محتوا
        const industry1Tags = industry1.contents[0]?.business_tags || [];
        const industry2Tags = industry2.contents[0]?.business_tags || [];

        // تشابه تگ‌ها
        const commonTags = industry1Tags.filter((tag: string) =>
            industry2Tags.includes(tag)
        );
        score += (commonTags.length / Math.max(industry1Tags.length, 1)) * 0.6;

        // تشابه شاخه
        if (industry1.industry_branch_id === industry2.industry_branch_id) {
            score += 0.4;
        }

        return Math.min(score, 1.0);
    }

    // ==================== Helper Methods ====================

    private formatRelationResponse(relation: any) {
        return {
            id: relation.id,
            supplier_industry_id: relation.supplier_industry_id,
            customer_industry_id: relation.customer_industry_id,
            relation_type: relation.relation_type,
            strength: relation.strength,
            created_at: relation.created_at,

            supplier_industry: relation.supplier_industry ? this.formatIndustryResponse(relation.supplier_industry) : null,
            customer_industry: relation.customer_industry ? this.formatIndustryResponse(relation.customer_industry) : null
        };
    }

    private formatIndustryResponse(industry: any) {
        const content = industry.contents?.[0] || {};

        return {
            id: industry.id,
            business_number: industry.business_number,
            business_type: industry.business_type,
            business_tags: content.business_tags || [], // حالا از content میاد
            related_tags: content.related_tags || [], // حالا از content میاد
            level: industry.level,
            is_active: industry.is_active,
            account_count: industry.account_count,

            // فیلدهای چندزبانه
            name: content.name,
            description: content.description,
            introduction: content.introduction,

            industry_branch: industry.industry_branch ? this.formatBranchResponse(industry.industry_branch) : null,
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

    private getRelationsCacheKey(query: IndustryRelationQueryDto): string {
        return `industry-relations:${JSON.stringify(query)}`;
    }

    private async clearRelationCache(id: string, language?: Language) {
        const cacheKeys = [
            `industry-relation:${id}`,
            `industry-relation:${id}:${language || this.DEFAULT_LANGUAGE}`,
            'industry-relation:stats',
            'industry-relation:stats:*'
        ];

        await Promise.all(cacheKeys.map(key => this.cacheManager.del(key)));
        await this.clearRelationsCache();
    }

    private async clearRelationsCache() {
        try {
            const knownKeys = [
                'industry-relation:stats'
            ];

            await Promise.all(knownKeys.map(key => this.cacheManager.del(key)));
        } catch (error) {
            console.error('Error clearing industry relations cache:', error);
        }
    }
}