import { Injectable, NotFoundException, ConflictException, BadRequestException, Inject } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateIndustryBranchDto } from "./dto/create-industry-branch.dto";
import { UpdateIndustryBranchDto } from "./dto/update-industry-branch.dto";
import { IndustryBranchQueryDto } from "./dto/industry-branch-query.dto";
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Language } from '@prisma/client';

@Injectable()
export class IndustryBranchService {
    constructor(
        private prisma: PrismaService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
    ) {}

    private readonly CACHE_TTL = 10 * 60 * 1000; // 10 دقیقه
    private readonly DEFAULT_LANGUAGE = Language.fa;

    async create(createIndustryBranchDto: CreateIndustryBranchDto) {
        const {
            name,
            description,
            department,
            language = this.DEFAULT_LANGUAGE,
            auto_translated = false,
            ...branchData
        } = createIndustryBranchDto;

        // بررسی تکراری نبودن کد
        const existingBranch = await this.prisma.industryBranch.findFirst({
            where: { code: branchData.code }
        });

        if (existingBranch) {
            throw new ConflictException("Industry branch with this code already exists");
        }

        // بررسی parentId اگر وجود دارد
        if (branchData.parentId) {
            const parent = await this.prisma.industryBranch.findUnique({
                where: { id: branchData.parentId }
            });

            if (!parent) {
                throw new NotFoundException("Parent industry branch not found");
            }
        }

        const branch = await this.prisma.industryBranch.create({
            data: {
                ...branchData,
                contents: {
                    create: {
                        language,
                        name,
                        description,
                        department,
                        auto_translated
                    }
                }
            },
            include: {
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
                                industries: true,
                                children: true
                            }
                        }
                    }
                },
                industries: {
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
                        industries: true,
                        children: true
                    }
                }
            }
        });

        await this.clearBranchesCache();
        return this.formatBranchResponse(branch);
    }

    async findAll(query: IndustryBranchQueryDto = {}) {
        const {
            page = 1,
            limit = 50,
            search,
            level,
            department,
            parentId,
            sortBy = 'name',
            sortOrder = 'asc',
            language = this.DEFAULT_LANGUAGE
        } = query;

        const cacheKey = this.getBranchesCacheKey(query);
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
                                { department: { contains: search, mode: 'insensitive' } },
                            ]
                        }
                    }
                },
                { code: { contains: search, mode: 'insensitive' } },
                { department_code: { contains: search, mode: 'insensitive' } },
            ];
        }

        if (level !== undefined) {
            where.level = level;
        }

        if (department) {
            where.contents = {
                some: {
                    language,
                    department: { contains: department, mode: 'insensitive' }
                }
            };
        }

        if (parentId) {
            where.parentId = parentId;
        } else {
            where.parentId = null;
        }

        const orderBy: any = {};
        if (sortBy === 'name') {
            orderBy.contents = {
                _count: 'desc'
            };
        } else {
            orderBy[sortBy] = sortOrder;
        }

        const [branches, total] = await Promise.all([
            this.prisma.industryBranch.findMany({
                where,
                skip,
                take: limit,
                include: {
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
                                    industries: true,
                                    children: true
                                }
                            }
                        }
                    },
                    industries: {
                        take: 3,
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
                            industries: true,
                            children: true
                        }
                    }
                },
                orderBy: sortBy === 'name' ? {
                    contents: {
                        name: sortOrder
                    }
                } : orderBy,
            }),
            this.prisma.industryBranch.count({ where })
        ]);

        const formattedBranches = branches.map(branch => this.formatBranchResponse(branch));

        const result = {
            data: formattedBranches,
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
        const cacheKey = `industry-branch:${id}:${language}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        const branch = await this.prisma.industryBranch.findUnique({
            where: { id },
            include: {
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
                                industries: true
                            }
                        }
                    }
                },
                industries: {
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
                        industries: true,
                        children: true
                    }
                }
            }
        });

        if (!branch) {
            throw new NotFoundException("Industry branch not found");
        }

        const formattedBranch = this.formatBranchResponse(branch);
        await this.cacheManager.set(cacheKey, formattedBranch, this.CACHE_TTL);
        return formattedBranch;
    }

    async findByCode(code: string, language: Language = this.DEFAULT_LANGUAGE) {
        const cacheKey = `industry-branch:code:${code}:${language}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        const branch = await this.prisma.industryBranch.findFirst({
            where: { code },
            include: {
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
                        }
                    }
                },
                contents: {
                    where: { language }
                },
                _count: {
                    select: {
                        industries: true
                    }
                }
            }
        });

        if (!branch) {
            return null;
        }

        const formattedBranch = this.formatBranchResponse(branch);
        await this.cacheManager.set(cacheKey, formattedBranch, this.CACHE_TTL);
        return formattedBranch;
    }

    async update(id: string, updateIndustryBranchDto: UpdateIndustryBranchDto, language: Language = this.DEFAULT_LANGUAGE) {
        const existingBranch = await this.prisma.industryBranch.findUnique({
            where: { id },
            include: {
                contents: {
                    where: { language }
                }
            }
        });

        if (!existingBranch) {
            throw new NotFoundException("Industry branch not found");
        }

        const { name, description, department, ...branchData } = updateIndustryBranchDto;

        // بررسی تکراری نبودن کد
        if (branchData.code && branchData.code !== existingBranch.code) {
            const duplicateBranch = await this.prisma.industryBranch.findFirst({
                where: {
                    code: branchData.code,
                    NOT: { id }
                }
            });

            if (duplicateBranch) {
                throw new ConflictException("Industry branch with this code already exists");
            }
        }

        // بررسی parentId اگر وجود دارد
        if (branchData.parentId) {
            if (branchData.parentId === id) {
                throw new BadRequestException("Industry branch cannot be its own parent");
            }

            const parent = await this.prisma.industryBranch.findUnique({
                where: { id: branchData.parentId }
            });

            if (!parent) {
                throw new NotFoundException("Parent industry branch not found");
            }
        }

        const contentUpdateData: any = {};
        if (name !== undefined) contentUpdateData.name = name;
        if (description !== undefined) contentUpdateData.description = description;
        if (department !== undefined) contentUpdateData.department = department;

        const updatedBranch = await this.prisma.industryBranch.update({
            where: { id },
            data: {
                ...branchData,
                contents: {
                    upsert: {
                        where: {
                            industry_branch_id_language: {
                                industry_branch_id: id,
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
                        }
                    }
                },
                contents: {
                    where: { language }
                },
                _count: {
                    select: {
                        industries: true,
                        children: true
                    }
                }
            }
        });

        await this.clearBranchCache(id, existingBranch.code, language);
        return this.formatBranchResponse(updatedBranch);
    }

    async remove(id: string) {
        const branch = await this.prisma.industryBranch.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        industries: true,
                        children: true
                    }
                }
            }
        });

        if (!branch) {
            throw new NotFoundException("Industry branch not found");
        }

        if (branch._count.industries > 0) {
            throw new BadRequestException("Cannot delete industry branch with associated industries");
        }

        if (branch._count.children > 0) {
            throw new BadRequestException("Cannot delete industry branch with children. Delete children first.");
        }

        await this.prisma.industryBranch.delete({
            where: { id },
        });

        await this.clearBranchCache(id, branch.code);
        return { message: "Industry branch deleted successfully" };
    }



    async getBranchesByLevel(level: number, language: Language = this.DEFAULT_LANGUAGE) {
        const cacheKey = `industry-branch:level:${level}:${language}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        const branches = await this.prisma.industryBranch.findMany({
            where: { level },
            include: {
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
                        industries: true
                    }
                }
            }
            // 🔥 مرتب‌سازی حذف شده - بعداً به صورت دستی انجام می‌دهیم
        });

        // 🔥 مرتب‌سازی دستی بر اساس نام
        const sortedBranches = branches.sort((a, b) => {
            const aName = a.contents[0]?.name || '';
            const bName = b.contents[0]?.name || '';
            return aName.localeCompare(bName, 'fa'); // برای زبان فارسی
        });

        const formattedBranches = sortedBranches.map(branch => this.formatBranchResponse(branch));
        await this.cacheManager.set(cacheKey, formattedBranches, this.CACHE_TTL);
        return formattedBranches;
    }

    async getBranchTree(parentId: string = null, language: Language = this.DEFAULT_LANGUAGE) {
        const cacheKey = `industry-branch:tree:${parentId || 'root'}:${language}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        const branches = await this.prisma.industryBranch.findMany({
            where: { parentId },
            include: {
                children: {
                    include: {
                        children: {
                            include: {
                                contents: {
                                    where: { language }
                                },
                                _count: {
                                    select: {
                                        industries: true
                                    }
                                }
                            }
                        },
                        contents: {
                            where: { language }
                        },
                        _count: {
                            select: {
                                industries: true,
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
                        industries: true,
                        children: true
                    }
                }
            }
            // 🔥 مرتب‌سازی حذف شده
        });

        // 🔥 مرتب‌سازی دستی
        const sortedBranches = branches.sort((a, b) => {
            const aName = a.contents[0]?.name || '';
            const bName = b.contents[0]?.name || '';
            return aName.localeCompare(bName, 'fa');
        });

        const formattedBranches = sortedBranches.map(branch => this.formatBranchResponse(branch));
        await this.cacheManager.set(cacheKey, formattedBranches, this.CACHE_TTL);
        return formattedBranches;
    }

    async getBranchStats(language: Language = this.DEFAULT_LANGUAGE) {
        const cacheKey = `industry-branch:stats:${language}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        const [
            totalBranches,
            level1Branches,
            level2Branches,
            level3Branches,
            branchesWithIndustries,
        ] = await Promise.all([
            this.prisma.industryBranch.count(),
            this.prisma.industryBranch.count({ where: { level: 1 } }),
            this.prisma.industryBranch.count({ where: { level: 2 } }),
            this.prisma.industryBranch.count({ where: { level: 3 } }),
            this.prisma.industryBranch.count({
                where: {
                    industries: { some: {} }
                }
            }),
        ]);

        const stats = {
            totalBranches,
            level1Branches,
            level2Branches,
            level3Branches,
            branchesWithIndustries,
            branchesWithoutIndustries: totalBranches - branchesWithIndustries,
        };

        await this.cacheManager.set(cacheKey, stats, this.CACHE_TTL);
        return stats;
    }

    // ==================== Public Methods ====================

    async getPublicBranches(query: IndustryBranchQueryDto = {}) {
        return this.findAll(query);
    }

    async getPublicBranchTree(language: Language = this.DEFAULT_LANGUAGE) {
        return this.getBranchTree(null, language);
    }

    // ==================== Helper Methods ====================

    private formatBranchResponse(branch: any) {
        const content = branch.contents?.[0] || {};

        return {
            id: branch.id,
            code: branch.code,
            level: branch.level,
            department_code: branch.department_code,
            business_tree_code: branch.business_tree_code,
            created_at: branch.created_at,
            updated_at: branch.updated_at,

            // فیلدهای چندزبانه
            name: content.name,
            description: content.description,
            department: content.department,
            auto_translated: content.auto_translated,

            // روابط
            parent: branch.parent ? this.formatBranchResponse(branch.parent) : null,
            children: branch.children?.map((child: any) => this.formatBranchResponse(child)) || [],
            industries: branch.industries || [],

            // آمار
            _count: branch._count
        };
    }

    // ==================== Cache Methods ====================

    private getBranchesCacheKey(query: IndustryBranchQueryDto): string {
        return `industry-branches:${JSON.stringify(query)}`;
    }

    private async clearBranchCache(id: string, code?: string, language?: Language) {
        const cacheKeys = [
            `industry-branch:${id}`,
            `industry-branch:${id}:${language || this.DEFAULT_LANGUAGE}`,
            'industry-branch:stats',
            'industry-branch:stats:*',
            'industry-branch:tree:root',
            'industry-branch:tree:root:*'
        ];

        if (code) {
            cacheKeys.push(`industry-branch:code:${code}`);
            cacheKeys.push(`industry-branch:code:${code}:${language || this.DEFAULT_LANGUAGE}`);
        }

        await Promise.all(cacheKeys.map(key => this.cacheManager.del(key)));
        await this.clearBranchesCache();
    }

    private async clearBranchesCache() {
        try {
            const cachePatterns = [
                'industry-branches:*',
                'industry-branch:level:*',
                'industry-branch:tree:*',
                'industry-branch:code:*'
            ];

            for (const pattern of cachePatterns) {
                try {
                    if (pattern === 'industry-branches:*') {
                        await this.cacheManager.del('industry-branches:{"page":1,"limit":50}');
                        await this.cacheManager.del('industry-branches:{"page":1,"limit":50,"sortBy":"name","sortOrder":"asc"}');
                    }
                } catch (error) {
                    continue;
                }
            }
        } catch (error) {
            console.error('Error clearing industry branches cache:', error);
        }
    }
}