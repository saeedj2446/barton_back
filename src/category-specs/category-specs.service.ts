// src/category-specs/category-specs.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategorySpecDto } from './dto/create-category-spec.dto';
import { CreateCategorySpecBulkDto } from './dto/create-category-spec.dto';
import { CategorySpecQueryDto } from './dto/category-spec-query.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Language } from '@prisma/client';
import { I18nService } from '../i18n/i18n.service';
import {
    I18nNotFoundException,
    I18nConflictException,
    I18nInternalServerErrorException,
} from '../common/exceptions/i18n-exceptions';

@Injectable()
export class CategorySpecsService {
    constructor(
        private prisma: PrismaService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        private i18nService: I18nService,
    ) {}

    private readonly CACHE_TTL = 10 * 60 * 1000;

    async create(createCategorySpecDto: CreateCategorySpecDto, language: Language = Language.fa) {
        return this.createCategorySpec(createCategorySpecDto, language);
    }

    async createBulk(createBulkDto: CreateCategorySpecBulkDto, language: Language = Language.fa) {
        return this.createCategorySpecsBulk(createBulkDto.relationships, language);
    }

    async findAll(query: CategorySpecQueryDto, language: Language = Language.fa) {
        return this.findCategorySpecs(query, language);
    }

    async findOne(id: string, language: Language = Language.fa) {
        return this.findCategorySpecById(id, language);
    }

    async findByCategoryAndSpec(categoryId: string, specId: string, language: Language = Language.fa) {
        return this.findCategorySpecByCategoryAndSpec(categoryId, specId, language);
    }

    async remove(categoryId: string, specId: string, language: Language = Language.fa) {
        return this.deleteCategorySpec(categoryId, specId, language);
    }

    async getByCategory(categoryId: string, language: Language = Language.fa) {
        return this.getCategorySpecsByCategory(categoryId, language);
    }

    async getBySpec(specId: string, language: Language = Language.fa) {
        return this.getCategorySpecsBySpec(specId, language);
    }

    // ==================== متدهای پیاده‌سازی ====================

    private async createCategorySpec(createCategorySpecDto: CreateCategorySpecDto, language: Language) {
        // بررسی وجود Category
        const category = await this.prisma.category.findUnique({
            where: { id: createCategorySpecDto.category_id },
            include: {
                contents: {
                    where: { language },
                    take: 1
                }
            }
        });

        if (!category) {
            throw new I18nNotFoundException('CATEGORY_NOT_FOUND', language, {
                id: createCategorySpecDto.category_id
            });
        }

        // بررسی وجود Spec
        const spec = await this.prisma.spec.findUnique({
            where: { id: createCategorySpecDto.spec_id },
            include: {
                contents: {
                    where: { language },
                    take: 1
                }
            }
        });

        if (!spec) {
            throw new I18nNotFoundException('SPEC_NOT_FOUND', language, {
                id: createCategorySpecDto.spec_id
            });
        }

        try {
            const categorySpec = await this.prisma.categorySpec.create({
                data: {
                    category_id: createCategorySpecDto.category_id,
                    spec_id: createCategorySpecDto.spec_id,
                },
                include: this.getCategorySpecInclude(language),
            });

            await this.clearCategorySpecsCache();
            return categorySpec;

        } catch (error) {
            // خطای تکراری بودن
            if (error.code === 'P2002') {
                const categoryName = category.contents[0]?.name || `Category ${category.bId}`;
                const specLabel = spec.contents[0]?.label || spec.key;

                throw new I18nConflictException(
                    'CATEGORY_SPEC_ALREADY_EXISTS',
                    language,
                    {
                        categoryName: categoryName,
                        specKey: specLabel
                    }
                );
            }

            throw new I18nInternalServerErrorException(
                'CATEGORY_SPEC_CREATE_ERROR',
                language
            );
        }
    }

    private async createCategorySpecsBulk(relationships: CreateCategorySpecDto[], language: Language) {
        // بررسی وجود Categoryها و Specها
        const categoryIds = [...new Set(relationships.map(r => r.category_id))];
        const specIds = [...new Set(relationships.map(r => r.spec_id))];

        const [categories, specs] = await Promise.all([
            this.prisma.category.findMany({
                where: { id: { in: categoryIds } },
                include: {
                    contents: {
                        where: { language },
                        take: 1
                    }
                }
            }),
            this.prisma.spec.findMany({
                where: { id: { in: specIds } },
                include: {
                    contents: {
                        where: { language },
                        take: 1
                    }
                }
            })
        ]);

        // بررسی وجود تمام Categoryها
        const missingCategoryIds = categoryIds.filter(id => !categories.find(c => c.id === id));
        if (missingCategoryIds.length > 0) {
            throw new I18nNotFoundException('CATEGORY_NOT_FOUND', language, {
                id: missingCategoryIds[0]
            });
        }

        // بررسی وجود تمام Specها
        const missingSpecIds = specIds.filter(id => !specs.find(s => s.id === id));
        if (missingSpecIds.length > 0) {
            throw new I18nNotFoundException('SPEC_NOT_FOUND', language, {
                id: missingSpecIds[0]
            });
        }

        try {
            // 🔧 راه‌حل جایگزین برای skipDuplicates در MongoDB
            const createdCategorySpecs = [];
            const errors = [];

            for (const rel of relationships) {
                try {
                    const categorySpec = await this.prisma.categorySpec.create({
                        data: {
                            category_id: rel.category_id,
                            spec_id: rel.spec_id,
                        },
                    });
                    createdCategorySpecs.push(categorySpec);
                } catch (error) {
                    // اگر خطای تکراری بودن بود، نادیده بگیر
                    if (error.code === 'P2002') {
                        console.log(`Duplicate category-spec skipped: ${rel.category_id} - ${rel.spec_id}`);
                        continue;
                    }
                    errors.push({ relationship: rel, error: error.message });
                }
            }

            // اگر خطاهای غیرتکراری داشتیم
            if (errors.length > 0) {
                console.error('Errors in bulk create:', errors);
                throw new I18nInternalServerErrorException(
                    'CATEGORY_SPECS_BULK_CREATE_ERROR',
                    language
                );
            }

            await this.clearCategorySpecsCache();

            return {
                success: true,
                createdCount: createdCategorySpecs.length,
                skippedCount: relationships.length - createdCategorySpecs.length,
                message: this.i18nService.t('CATEGORY_SPECS_BULK_CREATED', language, {
                    count: createdCategorySpecs.length,
                    skipped: relationships.length - createdCategorySpecs.length
                })
            };

        } catch (error) {
            if (error instanceof I18nInternalServerErrorException) {
                throw error;
            }
            throw new I18nInternalServerErrorException(
                'CATEGORY_SPECS_BULK_CREATE_ERROR',
                language
            );
        }
    }

    private async findCategorySpecs(query: CategorySpecQueryDto, language: Language) {
        const cacheKey = this.getCategorySpecsCacheKey(query, language);

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            const { page = 1, limit = 50, category_id, spec_id } = query;
            const skip = (page - 1) * limit;

            const where: any = {};

            if (category_id) {
                where.category_id = category_id;
            }

            if (spec_id) {
                where.spec_id = spec_id;
            }

            const [categorySpecs, total] = await Promise.all([
                this.prisma.categorySpec.findMany({
                    where,
                    skip,
                    take: limit,
                    include: this.getCategorySpecInclude(language),
                    orderBy: { created_at: 'desc' }
                }),
                this.prisma.categorySpec.count({ where }),
            ]);

            const result = {
                data: categorySpecs,
                meta: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            };

            await this.cacheManager.set(cacheKey, result, this.CACHE_TTL);
            return result;

        } catch (error) {
            throw new I18nInternalServerErrorException(
                'CATEGORY_SPECS_FETCH_ERROR',
                language
            );
        }
    }

    private async findCategorySpecById(id: string, language: Language) {
        const cacheKey = `category_spec:${id}:${language}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            const categorySpec = await this.prisma.categorySpec.findUnique({
                where: { id },
                include: this.getCategorySpecInclude(language),
            });

            if (!categorySpec) {
                throw new I18nNotFoundException('CATEGORY_SPEC_NOT_FOUND', language, { id });
            }

            await this.cacheManager.set(cacheKey, categorySpec, this.CACHE_TTL);
            return categorySpec;

        } catch (error) {
            if (error instanceof I18nNotFoundException) {
                throw error;
            }
            throw new I18nInternalServerErrorException('CATEGORY_SPEC_FETCH_ERROR', language);
        }
    }

    private async findCategorySpecByCategoryAndSpec(categoryId: string, specId: string, language: Language) {
        const cacheKey = `category_spec:${categoryId}:${specId}:${language}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            const categorySpec = await this.prisma.categorySpec.findUnique({
                where: {
                    category_id_spec_id: {
                        category_id: categoryId,
                        spec_id: specId,
                    }
                },
                include: this.getCategorySpecInclude(language),
            });

            if (!categorySpec) {
                throw new I18nNotFoundException('CATEGORY_SPEC_NOT_FOUND', language, {
                    categoryId, specId
                });
            }

            await this.cacheManager.set(cacheKey, categorySpec, this.CACHE_TTL);
            return categorySpec;

        } catch (error) {
            if (error instanceof I18nNotFoundException) {
                throw error;
            }
            throw new I18nInternalServerErrorException('CATEGORY_SPEC_FETCH_ERROR', language);
        }
    }

    private async deleteCategorySpec(categoryId: string, specId: string, language: Language) {
        const categorySpec = await this.prisma.categorySpec.findUnique({
            where: {
                category_id_spec_id: {
                    category_id: categoryId,
                    spec_id: specId,
                }
            },
        });

        if (!categorySpec) {
            throw new I18nNotFoundException('CATEGORY_SPEC_NOT_FOUND', language, { categoryId, specId });
        }

        try {
            await this.prisma.categorySpec.delete({
                where: {
                    category_id_spec_id: {
                        category_id: categoryId,
                        spec_id: specId,
                    }
                },
            });

            await this.clearCategorySpecsCache();

            return {
                message: this.i18nService.t('CATEGORY_SPEC_DELETED_SUCCESS', language),
                success: true
            };

        } catch (error) {
            throw new I18nInternalServerErrorException('CATEGORY_SPEC_DELETE_ERROR', language);
        }
    }

    private async getCategorySpecsByCategory(categoryId: string, language: Language) {
        const cacheKey = `category_specs:category:${categoryId}:${language}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            // بررسی وجود Category
            const category = await this.prisma.category.findUnique({
                where: { id: categoryId },
            });

            if (!category) {
                throw new I18nNotFoundException('CATEGORY_NOT_FOUND', language, { id: categoryId });
            }

            const categorySpecs = await this.prisma.categorySpec.findMany({
                where: { category_id: categoryId },
                include: this.getCategorySpecInclude(language),
                orderBy: { created_at: 'asc' }
            });

            await this.cacheManager.set(cacheKey, categorySpecs, this.CACHE_TTL);
            return categorySpecs;

        } catch (error) {
            if (error instanceof I18nNotFoundException) {
                throw error;
            }
            throw new I18nInternalServerErrorException('CATEGORY_SPECS_FETCH_ERROR', language);
        }
    }

    private async getCategorySpecsBySpec(specId: string, language: Language) {
        const cacheKey = `category_specs:spec:${specId}:${language}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            // بررسی وجود Spec
            const spec = await this.prisma.spec.findUnique({
                where: { id: specId },
            });

            if (!spec) {
                throw new I18nNotFoundException('SPEC_NOT_FOUND', language, { id: specId });
            }

            const categorySpecs = await this.prisma.categorySpec.findMany({
                where: { spec_id: specId },
                include: this.getCategorySpecInclude(language),
                orderBy: { created_at: 'asc' }
            });

            await this.cacheManager.set(cacheKey, categorySpecs, this.CACHE_TTL);
            return categorySpecs;

        } catch (error) {
            if (error instanceof I18nNotFoundException) {
                throw error;
            }
            throw new I18nInternalServerErrorException('CATEGORY_SPECS_FETCH_ERROR', language);
        }
    }

    // ==================== متدهای کمکی ====================

    private getCategorySpecInclude(language: Language) {
        return {
            category: {
                include: {
                    contents: {
                        where: { language }
                    }
                }
            },
            spec: {
                include: {
                    contents: {
                        where: { language }
                    }
                }
            }
        };
    }

    // ==================== مدیریت کش ====================

    private getCategorySpecsCacheKey(query: CategorySpecQueryDto, language: Language): string {
        return `category_specs:${language}:${JSON.stringify(query)}`;
    }

    private async clearCategorySpecsCache(language?: Language) {
        try {
            const keys = [
                'category_specs:',
                'category_specs:category:',
                'category_specs:spec:',
                'category_spec:'
            ];

            if (language) {
                const languageKeys = keys.map(key => `${key}${language}:`);
                await Promise.all(languageKeys.map(key => this.cacheManager.del(key)));
            } else {
                const allLanguageKeys = Object.values(Language).flatMap(lang =>
                    keys.map(key => `${key}${lang}:`)
                );
                await Promise.all(allLanguageKeys.map(key => this.cacheManager.del(key)));
            }
        } catch (error) {
            console.error('Error clearing category specs cache:', error);
        }
    }
}