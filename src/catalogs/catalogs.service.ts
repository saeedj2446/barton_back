// src/catalogs/catalogs.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCatalogDto } from './dto/create-catalog.dto';
import { UpdateCatalogDto } from './dto/update-catalog.dto';
import { CatalogQueryDto } from './dto/catalog-query.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { CatalogStatus, Language } from '@prisma/client';
import { I18nService } from '../i18n/i18n.service';
import {
    I18nNotFoundException,
    I18nConflictException,
    I18nInternalServerErrorException,
} from '../common/exceptions/i18n-exceptions';

@Injectable()
export class CatalogsService {
    constructor(
        private prisma: PrismaService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        private i18nService: I18nService,
    ) {}

    private readonly CACHE_TTL = 10 * 60 * 1000;

    async create(createCatalogDto: CreateCatalogDto, language: Language = Language.fa) {
        return this.createCatalog(createCatalogDto, language);
    }

    async findAll(query: CatalogQueryDto, language: Language = Language.fa) {
        return this.findCatalogs(query, language);
    }

    async findOne(id: string, language: Language = Language.fa) {
        return this.findCatalogById(id, language);
    }

    async update(id: string, updateCatalogDto: UpdateCatalogDto, language: Language = Language.fa) {
        return this.updateCatalog(id, updateCatalogDto, language);
    }

    async remove(id: string, language: Language = Language.fa) {
        return this.deleteCatalog(id, language);
    }

    async approveCatalog(id: string, reviewedBy: string, language: Language = Language.fa) {
        return this.approveCatalogById(id, reviewedBy, language);
    }

    async rejectCatalog(id: string, reviewedBy: string, rejectionReason: string, language: Language = Language.fa) {
        return this.rejectCatalogById(id, reviewedBy, rejectionReason, language);
    }

    // ==================== متدهای پیاده‌سازی ====================

    private async createCatalog(createCatalogDto: CreateCatalogDto, language: Language) {
        // بررسی وجود Brand
        const brand = await this.prisma.brand.findUnique({
            where: { id: createCatalogDto.brand_id },
        });

        if (!brand) {
            throw new I18nNotFoundException('BRAND_NOT_FOUND', language, {
                id: createCatalogDto.brand_id
            });
        }

        // بررسی وجود Category
        const category = await this.prisma.category.findUnique({
            where: { id: createCatalogDto.category_id },
        });

        if (!category) {
            throw new I18nNotFoundException('CATEGORY_NOT_FOUND', language, {
                id: createCatalogDto.category_id
            });
        }

        // بررسی وجود Manufacturer Account
        const manufacturerAccount = await this.prisma.account.findUnique({
            where: { id: createCatalogDto.manufacturer_account_id },
        });

        if (!manufacturerAccount) {
            throw new I18nNotFoundException('ACCOUNT_NOT_FOUND', language, {
                id: createCatalogDto.manufacturer_account_id
            });
        }

        // بررسی تکراری نبودن نام در محتوای چندزبانه
        const catalogNames = createCatalogDto.contents.map(content => content.name);
        const existingCatalog = await this.prisma.catalog.findFirst({
            where: {
                contents: {
                    some: {
                        name: {
                            in: catalogNames
                        }
                    }
                }
            },
            include: {
                contents: true
            }
        });

        if (existingCatalog) {
            const existingName = existingCatalog.contents.find(content =>
                catalogNames.includes(content.name)
            )?.name;
            throw new I18nConflictException(
                'CATALOG_ALREADY_EXISTS',
                language,
                { name: existingName }
            );
        }

        // بررسی تکراری نبودن مدل شمار
        if (createCatalogDto.model_number) {
            const existingModel = await this.prisma.catalog.findFirst({
                where: {
                    model_number: createCatalogDto.model_number,
                    brand_id: createCatalogDto.brand_id
                },
            });

            if (existingModel) {
                throw new I18nConflictException(
                    'CATALOG_MODEL_EXISTS',
                    language,
                    { modelNumber: createCatalogDto.model_number }
                );
            }
        }

        try {
            const catalogData: any = {
                model_number: createCatalogDto.model_number,
                sku_pattern: createCatalogDto.sku_pattern,
                status: createCatalogDto.status,
                is_public: createCatalogDto.is_public,
                brand_id: createCatalogDto.brand_id,
                category_id: createCatalogDto.category_id,
                manufacturer_account_id: createCatalogDto.manufacturer_account_id,
                sell_unit: createCatalogDto.sell_unit,
                spect_units: createCatalogDto.spect_units,
                images: createCatalogDto.images || [],
                documents: createCatalogDto.documents || [],
                video_url: createCatalogDto.video_url,
                special_specs: createCatalogDto.special_specs,
                contents: {
                    create: createCatalogDto.contents.map(content => ({
                        language: content.language,
                        name: content.name,
                        description: content.description,
                        auto_translated: content.auto_translated || false,
                    }))
                }
            };

            // اگر مشخصات فنی ارسال شده، اضافه کن
            if (createCatalogDto.catalog_specs && createCatalogDto.catalog_specs.length > 0) {
                catalogData.catalog_specs = {
                    create: createCatalogDto.catalog_specs.map(spec => ({
                        spec_id: spec.spec_id,
                        value: spec.value,
                        spec_type: spec.spec_type,
                    }))
                };
            }

            const catalog = await this.prisma.catalog.create({
                data: catalogData,
                include: this.getCatalogInclude(language),
            });

            await this.clearCatalogsCache();
            return this.mergeMultilingualContent(catalog, language);

        } catch (error) {
            throw new I18nInternalServerErrorException(
                'CATALOG_CREATE_ERROR',
                language
            );
        }
    }

    private async findCatalogs(query: CatalogQueryDto, language: Language) {
        const cacheKey = this.getCatalogsCacheKey(query, language);

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            const { page = 1, limit = 50, search, brand_id, category_id, manufacturer_account_id, status, is_public } = query;
            const skip = (page - 1) * limit;

            const where: any = {};

            if (brand_id) {
                where.brand_id = brand_id;
            }

            if (category_id) {
                where.category_id = category_id;
            }

            if (manufacturer_account_id) {
                where.manufacturer_account_id = manufacturer_account_id;
            }

            if (status) {
                where.status = status;
            }

            if (is_public !== undefined) {
                where.is_public = is_public;
            }

            if (search) {
                where.OR = [
                    {
                        contents: {
                            some: {
                                language,
                                name: { contains: search, mode: 'insensitive' }
                            }
                        }
                    },
                    { name: { contains: search, mode: 'insensitive' } },
                    { name_fa: { contains: search, mode: 'insensitive' } },
                    { model_number: { contains: search, mode: 'insensitive' } }
                ];
            }

            const [catalogs, total] = await Promise.all([
                this.prisma.catalog.findMany({
                    where,
                    skip,
                    take: limit,
                    include: this.getCatalogInclude(language),
                    orderBy: { created_at: 'desc' }
                }),
                this.prisma.catalog.count({ where }),
            ]);

            const result = {
                data: catalogs.map(catalog => this.mergeMultilingualContent(catalog, language)),
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
                'CATALOGS_FETCH_ERROR',
                language
            );
        }
    }

    private async findCatalogById(id: string, language: Language) {
        const cacheKey = `catalog:${id}:${language}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            const catalog = await this.prisma.catalog.findUnique({
                where: { id },
                include: this.getDetailedCatalogInclude(language),
            });

            if (!catalog) {
                throw new I18nNotFoundException('CATALOG_NOT_FOUND', language, { id });
            }

            const mergedCatalog = this.mergeMultilingualContent(catalog, language);
            await this.cacheManager.set(cacheKey, mergedCatalog, this.CACHE_TTL);
            return mergedCatalog;

        } catch (error) {
            if (error instanceof I18nNotFoundException) {
                throw error;
            }
            throw new I18nInternalServerErrorException('CATALOG_FETCH_ERROR', language);
        }
    }

    private async updateCatalog(id: string, updateCatalogDto: UpdateCatalogDto, language: Language) {
        const existingCatalog = await this.prisma.catalog.findUnique({
            where: { id },
        });

        if (!existingCatalog) {
            throw new I18nNotFoundException('CATALOG_NOT_FOUND', language, { id });
        }

        // بررسی Brand اگر آپدیت شده
        if (updateCatalogDto.brand_id && updateCatalogDto.brand_id !== existingCatalog.brand_id) {
            const brand = await this.prisma.brand.findUnique({
                where: { id: updateCatalogDto.brand_id },
            });

            if (!brand) {
                throw new I18nNotFoundException('BRAND_NOT_FOUND', language, {
                    id: updateCatalogDto.brand_id
                });
            }
        }

        // بررسی Category اگر آپدیت شده
        if (updateCatalogDto.category_id && updateCatalogDto.category_id !== existingCatalog.category_id) {
            const category = await this.prisma.category.findUnique({
                where: { id: updateCatalogDto.category_id },
            });

            if (!category) {
                throw new I18nNotFoundException('CATEGORY_NOT_FOUND', language, {
                    id: updateCatalogDto.category_id
                });
            }
        }

        // بررسی تکراری نبودن نام در محتوای چندزبانه
        if (updateCatalogDto.contents && updateCatalogDto.contents.length > 0) {
            const catalogNames = updateCatalogDto.contents.map(content => content.name);
            const duplicateCatalog = await this.prisma.catalog.findFirst({
                where: {
                    AND: [
                        { id: { not: id } },
                        {
                            contents: {
                                some: {
                                    name: {
                                        in: catalogNames
                                    }
                                }
                            }
                        }
                    ]
                },
                include: {
                    contents: true
                }
            });

            if (duplicateCatalog) {
                const existingName = duplicateCatalog.contents.find(content =>
                    catalogNames.includes(content.name)
                )?.name;
                throw new I18nConflictException(
                    'CATALOG_ALREADY_EXISTS',
                    language,
                    { name: existingName }
                );
            }
        }

        // بررسی تکراری نبودن مدل شمار
        if (updateCatalogDto.model_number && updateCatalogDto.model_number !== existingCatalog.model_number) {
            const existingModel = await this.prisma.catalog.findFirst({
                where: {
                    model_number: updateCatalogDto.model_number,
                    brand_id: updateCatalogDto.brand_id || existingCatalog.brand_id
                },
            });

            if (existingModel) {
                throw new I18nConflictException(
                    'CATALOG_MODEL_EXISTS',
                    language,
                    { modelNumber: updateCatalogDto.model_number }
                );
            }
        }

        try {
            const updateData: any = { ...updateCatalogDto };
            delete updateData.contents;
            delete updateData.catalog_specs;

            // اگر محتوای چندزبانه برای آپدیت ارسال شده
            if (updateCatalogDto.contents && updateCatalogDto.contents.length > 0) {
                const updatedCatalog = await this.prisma.catalog.update({
                    where: { id },
                    data: updateData,
                });

                // آپدیت محتوای چندزبانه
                await Promise.all(
                    updateCatalogDto.contents.map(content =>
                        this.prisma.catalogContent.upsert({
                            where: {
                                catalog_id_language: {
                                    catalog_id: id,
                                    language: content.language
                                }
                            },
                            create: {
                                catalog_id: id,
                                language: content.language,
                                name: content.name,
                                description: content.description,
                                auto_translated: content.auto_translated || false,
                            },
                            update: {
                                name: content.name,
                                description: content.description,
                                auto_translated: content.auto_translated,
                            }
                        })
                    )
                );

                // دریافت Catalog با محتوای به‌روز شده
                const finalCatalog = await this.prisma.catalog.findUnique({
                    where: { id },
                    include: this.getCatalogInclude(language),
                });

                await this.clearCatalogCache(id, language);
                return this.mergeMultilingualContent(finalCatalog, language);

            } else {
                // آپدیت ساده بدون محتوای چندزبانه
                const updatedCatalog = await this.prisma.catalog.update({
                    where: { id },
                    data: updateData,
                    include: this.getCatalogInclude(language),
                });

                await this.clearCatalogCache(id, language);
                return this.mergeMultilingualContent(updatedCatalog, language);
            }

        } catch (error) {
            if (error instanceof I18nNotFoundException || error instanceof I18nConflictException) {
                throw error;
            }
            throw new I18nInternalServerErrorException('CATALOG_UPDATE_ERROR', language);
        }
    }

    private async deleteCatalog(id: string, language: Language) {
        const catalog = await this.prisma.catalog.findUnique({
            where: { id },
            include: {
                used_in_products: {
                    select: { id: true }
                }
            }
        });

        if (!catalog) {
            throw new I18nNotFoundException('CATALOG_NOT_FOUND', language, { id });
        }

        // بررسی استفاده در محصولات
        if (catalog.used_in_products.length > 0) {
            throw new I18nConflictException('DELETE_CATALOG_WITH_PRODUCTS', language, {
                productsCount: catalog.used_in_products.length
            });
        }

        try {
            await this.prisma.catalog.delete({
                where: { id },
            });

            await this.clearCatalogCache(id, language);

            return {
                message: this.i18nService.t('CATALOG_DELETED_SUCCESS', language),
                success: true
            };

        } catch (error) {
            throw new I18nInternalServerErrorException('CATALOG_DELETE_ERROR', language);
        }
    }

    private async approveCatalogById(id: string, reviewedBy: string, language: Language) {
        const catalog = await this.prisma.catalog.findUnique({
            where: { id },
        });

        if (!catalog) {
            throw new I18nNotFoundException('CATALOG_NOT_FOUND', language, { id });
        }

        if (catalog.status === CatalogStatus.APPROVED) {
            throw new I18nConflictException('CATALOG_ALREADY_APPROVED', language);
        }

        try {
            const approvedCatalog = await this.prisma.catalog.update({
                where: { id },
                data: {
                    status: CatalogStatus.APPROVED,
                    reviewed_by: reviewedBy,
                    reviewed_at: new Date(),
                },
                include: this.getCatalogInclude(language),
            });

            await this.clearCatalogCache(id, language);
            return this.mergeMultilingualContent(approvedCatalog, language);

        } catch (error) {
            throw new I18nInternalServerErrorException('CATALOG_APPROVE_ERROR', language);
        }
    }

    private async rejectCatalogById(id: string, reviewedBy: string, rejectionReason: string, language: Language) {
        const catalog = await this.prisma.catalog.findUnique({
            where: { id },
        });

        if (!catalog) {
            throw new I18nNotFoundException('CATALOG_NOT_FOUND', language, { id });
        }

        if (catalog.status === CatalogStatus.REJECTED) {
            throw new I18nConflictException('CATALOG_ALREADY_REJECTED', language);
        }

        try {
            const rejectedCatalog = await this.prisma.catalog.update({
                where: { id },
                data: {
                    status: CatalogStatus.REJECTED,
                    reviewed_by: reviewedBy,
                    reviewed_at: new Date(),
                    rejection_reason: rejectionReason,
                },
                include: this.getCatalogInclude(language),
            });

            await this.clearCatalogCache(id, language);
            return this.mergeMultilingualContent(rejectedCatalog, language);

        } catch (error) {
            throw new I18nInternalServerErrorException('CATALOG_REJECT_ERROR', language);
        }
    }

    // ==================== متدهای مدیریت محتوای چندزبانه ====================

    async createCatalogContent(catalogId: string, contentDto: any, language: Language = Language.fa) {
        const catalog = await this.prisma.catalog.findUnique({
            where: { id: catalogId }
        });

        if (!catalog) {
            throw new I18nNotFoundException('CATALOG_NOT_FOUND', language, { id: catalogId });
        }

        try {
            const content = await this.prisma.catalogContent.create({
                data: {
                    catalog_id: catalogId,
                    language: contentDto.language,
                    name: contentDto.name,
                    description: contentDto.description,
                    auto_translated: contentDto.auto_translated || false,
                }
            });

            await this.clearCatalogCache(catalogId, contentDto.language);
            return content;

        } catch (error) {
            throw new I18nInternalServerErrorException('CATALOG_CONTENT_CREATE_ERROR', language);
        }
    }

    async getCatalogTranslations(catalogId: string, language: Language = Language.fa) {
        try {
            return await this.prisma.catalogContent.findMany({
                where: { catalog_id: catalogId },
                select: {
                    language: true,
                    name: true,
                    description: true,
                    auto_translated: true,
                }
            });
        } catch (error) {
            throw new I18nInternalServerErrorException('CATALOG_TRANSLATIONS_FETCH_ERROR', language);
        }
    }

    // ==================== متدهای کمکی ====================

    private mergeMultilingualContent(catalog: any, language: Language) {
        if (!catalog) return catalog;

        const content = catalog.contents?.find((c: any) => c.language === language);

        return {
            ...catalog,
            name: content?.name || catalog.name,
            description: content?.description || catalog.description,
            contents: undefined
        };
    }

    private getCatalogInclude(language: Language) {
        return {
            contents: {
                where: { language }
            },
            brand: {
                include: {
                    contents: {
                        where: { language }
                    }
                }
            },
            category: {
                include: {
                    contents: {
                        where: { language }
                    }
                }
            },
            manufacturer_account: {
                select: {
                    id: true,
                    name: true,
                    logo: true,
                }
            },
            _count: {
                select: {
                    used_in_products: true,
                    catalog_specs: true,
                }
            }
        };
    }

    private getDetailedCatalogInclude(language: Language) {
        return {
            ...this.getCatalogInclude(language),
            catalog_specs: {
                include: {
                    spec: {
                        include: {
                            contents: {
                                where: { language }
                            }
                        }
                    }
                }
            },
            used_in_products: {
                include: {
                    contents: {
                        where: { language }
                    }
                },
                take: 10 // فقط 10 محصول اخیر
            }
        };
    }

    // ==================== مدیریت کش ====================

    private getCatalogsCacheKey(query: CatalogQueryDto, language: Language): string {
        return `catalogs:${language}:${JSON.stringify(query)}`;
    }

    private async clearCatalogCache(catalogId: string, language?: Language) {
        const cacheKeys = [
            `catalog:${catalogId}:${language || '*'}`,
        ];

        await Promise.all(cacheKeys.map(cacheKey => this.cacheManager.del(cacheKey)));
        await this.clearCatalogsCache(language);
    }

    private async clearCatalogsCache(language?: Language) {
        try {
            const keys = ['catalogs:'];

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
            console.error('Error clearing catalogs cache:', error);
        }
    }
}