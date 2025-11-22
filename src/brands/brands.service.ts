// src/brands/brands.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {CreateBrandContentDto, CreateBrandDto} from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { BrandQueryDto } from './dto/brand-query.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { BrandType, ManufacturerType, Language } from '@prisma/client';
import { I18nService } from '../i18n/i18n.service';
import {
    I18nNotFoundException,
    I18nConflictException,
    I18nInternalServerErrorException,
} from '../common/exceptions/i18n-exceptions';

@Injectable()
export class BrandsService {
    constructor(
        private prisma: PrismaService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        private i18nService: I18nService,
    ) {}

    private readonly CACHE_TTL = 10 * 60 * 1000; // 10 minutes

    // ==================== متدهای اصلی ====================

    async create(createBrandDto: CreateBrandDto, language: Language = Language.fa) {
        return this.createBrand(createBrandDto, language);
    }

    async findAll(query: BrandQueryDto, language: Language = Language.fa) {
        return this.findBrands(query, language);
    }

    async findOne(id: string, language: Language = Language.fa) {
        return this.findBrandById(id, language);
    }

    async update(id: string, updateBrandDto: UpdateBrandDto, language: Language = Language.fa) {
        return this.updateBrand(id, updateBrandDto, language);
    }

    async remove(id: string, language: Language = Language.fa) {
        return this.deleteBrand(id, language);
    }

    // ==================== متدهای پیاده‌سازی ====================

    private async createBrand(createBrandDto: CreateBrandDto, language: Language) {
        // بررسی تکراری نبودن نام در تمام زبان‌ها
        const brandNames = createBrandDto.contents.map(content => content.name);
        const existingBrand = await this.prisma.brand.findFirst({
            where: {
                contents: {
                    some: {
                        name: {
                            in: brandNames
                        }
                    }
                }
            },
            include: {
                contents: true
            }
        });

        if (existingBrand) {
            const existingName = existingBrand.contents.find(content =>
                brandNames.includes(content.name)
            )?.name;
            throw new I18nConflictException(
                'BRAND_ALREADY_EXISTS',
                language,
                { name: existingName }
            );
        }

        // بررسی industry_id اگر وجود دارد
        if (createBrandDto.industry_id) {
            const industry = await this.prisma.industry.findUnique({
                where: { id: createBrandDto.industry_id },
            });

            if (!industry) {
                throw new I18nNotFoundException(
                    'INDUSTRY_NOT_FOUND',
                    language,
                    { industryId: createBrandDto.industry_id }
                );
            }
        }

        // بررسی account_id اگر وجود دارد
        if (createBrandDto.account_id) {
            const account = await this.prisma.account.findUnique({
                where: { id: createBrandDto.account_id },
            });

            if (!account) {
                throw new I18nNotFoundException(
                    'ACCOUNT_NOT_FOUND',
                    language,
                    { accountId: createBrandDto.account_id }
                );
            }
        }

        try {
            const brandData: any = {
                logo: createBrandDto.logo,
                brand_type: createBrandDto.brand_type,
                manufacturer_type: createBrandDto.manufacturer_type,
                country: createBrandDto.country,
                website: createBrandDto.website,
                region: createBrandDto.region,
                industry_id: createBrandDto.industry_id,
                account_id: createBrandDto.account_id,
                contents: {
                    create: createBrandDto.contents.map(content => ({
                        language: content.language,
                        name: content.name,
                        description: content.description,
                        auto_translated: content.auto_translated || false,
                    }))
                }
            };

            const brand = await this.prisma.brand.create({
                data: brandData,
                include: this.getBrandInclude(language),
            });

            await this.clearBrandsCache();
            return this.mergeMultilingualContent(brand, language);

        } catch (error) {
            throw new I18nInternalServerErrorException(
                'BRAND_CREATE_ERROR',
                language
            );
        }
    }

    private async findBrands(query: BrandQueryDto, language: Language) {
        const cacheKey = this.getBrandsCacheKey(query, language);

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            const { page = 1, limit = 50, search, brand_type, manufacturer_type, industry_id, is_verified } = query;
            const skip = (page - 1) * limit;

            const where: any = {};

            if (brand_type) {
                where.brand_type = brand_type;
            }

            if (manufacturer_type) {
                where.manufacturer_type = manufacturer_type;
            }

            if (industry_id) {
                where.industry_id = industry_id;
            }

            if (is_verified !== undefined) {
                where.is_verified = is_verified;
            }

            if (search) {
                where.OR = [
                    {
                        contents: {
                            some: {
                                name: { contains: search, mode: 'insensitive' }
                            }
                        }
                    }
                ];
            }

            const [brands, total] = await Promise.all([
                this.prisma.brand.findMany({
                    where,
                    skip,
                    take: limit,
                    include: this.getBrandInclude(language),
                    orderBy: { created_at: 'desc' }
                }),
                this.prisma.brand.count({ where }),
            ]);

            const result = {
                data: brands.map(brand => this.mergeMultilingualContent(brand, language)),
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
                'BRANDS_FETCH_ERROR',
                language
            );
        }
    }

    private async findBrandById(id: string, language: Language) {
        const cacheKey = `brand:${id}:${language}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            const brand = await this.prisma.brand.findUnique({
                where: { id },
                include: this.getDetailedBrandInclude(language),
            });

            if (!brand) {
                throw new I18nNotFoundException('BRAND_NOT_FOUND', language, { id });
            }

            const mergedBrand = this.mergeMultilingualContent(brand, language);
            await this.cacheManager.set(cacheKey, mergedBrand, this.CACHE_TTL);
            return mergedBrand;

        } catch (error) {
            if (error instanceof I18nNotFoundException) {
                throw error;
            }
            throw new I18nInternalServerErrorException('BRAND_FETCH_ERROR', language);
        }
    }

    private async updateBrand(id: string, updateBrandDto: UpdateBrandDto, language: Language) {
        const existingBrand = await this.prisma.brand.findUnique({
            where: { id },
        });

        if (!existingBrand) {
            throw new I18nNotFoundException('BRAND_NOT_FOUND', language, { id });
        }

        // بررسی نام‌های تکراری در محتوای چندزبانه
        if (updateBrandDto.contents && updateBrandDto.contents.length > 0) {
            const brandNames = updateBrandDto.contents.map(content => content.name);
            const duplicateBrand = await this.prisma.brand.findFirst({
                where: {
                    AND: [
                        { id: { not: id } },
                        {
                            contents: {
                                some: {
                                    name: {
                                        in: brandNames
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

            if (duplicateBrand) {
                const existingName = duplicateBrand.contents.find(content =>
                    brandNames.includes(content.name)
                )?.name;
                throw new I18nConflictException(
                    'BRAND_ALREADY_EXISTS',
                    language,
                    { name: existingName }
                );
            }
        }

        // بررسی industry_id اگر وجود دارد
        if (updateBrandDto.industry_id) {
            const industry = await this.prisma.industry.findUnique({
                where: { id: updateBrandDto.industry_id },
            });

            if (!industry) {
                throw new I18nNotFoundException(
                    'INDUSTRY_NOT_FOUND',
                    language,
                    { industryId: updateBrandDto.industry_id }
                );
            }
        }

        try {
            const updateData: any = { ...updateBrandDto };
            delete updateData.contents;

            // اگر محتوای چندزبانه برای آپدیت ارسال شده
            if (updateBrandDto.contents && updateBrandDto.contents.length > 0) {
                const updatedBrand = await this.prisma.brand.update({
                    where: { id },
                    data: updateData,
                });

                // آپدیت محتوای چندزبانه
                await Promise.all(
                    updateBrandDto.contents.map(content =>
                        this.prisma.brandContent.upsert({
                            where: {
                                brand_id_language: {
                                    brand_id: id,
                                    language: content.language
                                }
                            },
                            create: {
                                brand_id: id,
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

                // دریافت برند با محتوای به‌روز شده
                const finalBrand = await this.prisma.brand.findUnique({
                    where: { id },
                    include: this.getBrandInclude(language),
                });

                await this.clearBrandCache(id, language);
                return this.mergeMultilingualContent(finalBrand, language);

            } else {
                // آپدیت ساده بدون محتوای چندزبانه
                const updatedBrand = await this.prisma.brand.update({
                    where: { id },
                    data: updateData,
                    include: this.getBrandInclude(language),
                });

                await this.clearBrandCache(id, language);
                return this.mergeMultilingualContent(updatedBrand, language);
            }

        } catch (error) {
            if (error instanceof I18nNotFoundException || error instanceof I18nConflictException) {
                throw error;
            }
            throw new I18nInternalServerErrorException('BRAND_UPDATE_ERROR', language);
        }
    }
    private async deleteBrand(id: string, language: Language) {
        const brand = await this.prisma.brand.findUnique({
            where: { id },
            include: {
                catalogs: {
                    select: { id: true }
                }
            }
        });

        if (!brand) {
            throw new I18nNotFoundException('BRAND_NOT_FOUND', language, { id });
        }

        // بررسی استفاده در کاتالوگ‌ها
        if (brand.catalogs.length > 0) {
            throw new I18nConflictException('DELETE_BRAND_WITH_CATALOGS', language, {
                catalogsCount: brand.catalogs.length
            });
        }

        try {
            await this.prisma.brand.delete({
                where: { id },
            });

            await this.clearBrandCache(id, language);

            return {
                message: this.i18nService.t('BRAND_DELETED_SUCCESS', language),
                success: true
            };

        } catch (error) {
            throw new I18nInternalServerErrorException('BRAND_DELETE_ERROR', language);
        }
    }

    // ==================== متدهای مدیریت محتوای چندزبانه ====================

    async createBrandContent(brandId: string, contentDto: CreateBrandContentDto, language: Language = Language.fa) {
        const brand = await this.prisma.brand.findUnique({
            where: { id: brandId }
        });

        if (!brand) {
            throw new I18nNotFoundException('BRAND_NOT_FOUND', language, { id: brandId });
        }

        try {
            const content = await this.prisma.brandContent.create({
                data: {
                    brand_id: brandId,
                    language: contentDto.language,
                    name: contentDto.name,
                    description: contentDto.description,
                    auto_translated: contentDto.auto_translated || false,
                }
            });

            await this.clearBrandCache(brandId, contentDto.language);
            return content;

        } catch (error) {
            throw new I18nInternalServerErrorException('BRAND_CONTENT_CREATE_ERROR', language);
        }
    }

    async getBrandTranslations(brandId: string, language: Language = Language.fa) {
        try {
            return await this.prisma.brandContent.findMany({
                where: { brand_id: brandId },
                select: {
                    language: true,
                    name: true,
                    description: true,
                    auto_translated: true,
                }
            });
        } catch (error) {
            throw new I18nInternalServerErrorException('BRAND_TRANSLATIONS_FETCH_ERROR', language);
        }
    }

    // ==================== متدهای کمکی ====================

    private mergeMultilingualContent(brand: any, language: Language) {
        if (!brand) return brand;

        const content = brand.contents?.find((c: any) => c.language === language);

        return {
            ...brand,
            name: content?.name || brand.name,
            description: content?.description || brand.description,
            contents: undefined
        };
    }

    private getBrandInclude(language: Language) {
        return {
            contents: {
                where: { language }
            },
            industry: {
                include: {
                    contents: {
                        where: { language }
                    }
                }
            },
            account: {
                select: {
                    id: true,
                    name: true,
                    logo: true,
                }
            },
            _count: {
                select: {
                    catalogs: true,
                }
            }
        };
    }

    private getDetailedBrandInclude(language: Language) {
        return {
            ...this.getBrandInclude(language),
            catalogs: {
                include: {
                    contents: {
                        where: { language }
                    }
                }
            }
        };
    }

    // ==================== مدیریت کش ====================

    private getBrandsCacheKey(query: BrandQueryDto, language: Language): string {
        return `brands:${language}:${JSON.stringify(query)}`;
    }

    private async clearBrandCache(brandId: string, language?: Language) {
        const cacheKeys = [
            `brand:${brandId}:${language || '*'}`,
        ];

        if (language) {
            cacheKeys.push(`brand:${brandId}:${language}`);
        } else {
            Object.values(Language).forEach(lang => {
                cacheKeys.push(`brand:${brandId}:${lang}`);
            });
        }

        await Promise.all(cacheKeys.map(key => this.cacheManager.del(key)));
        await this.clearBrandsCache(language);
    }

    private async clearBrandsCache(language?: Language) {
        try {
            const knownKeys = [
                'brands:',
            ];

            if (language) {
                const languageKeys = knownKeys.map(key => `${key}${language}:`);
                await Promise.all(languageKeys.map(key => this.cacheManager.del(key)));
            } else {
                const allLanguageKeys = Object.values(Language).flatMap(lang =>
                    knownKeys.map(key => `${key}${lang}:`)
                );
                await Promise.all(allLanguageKeys.map(key => this.cacheManager.del(key)));
            }
        } catch (error) {
            console.error('Error clearing brands cache:', error);
        }
    }
}