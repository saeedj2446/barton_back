// src/specs/specs.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSpecDto } from './dto/create-spec.dto';
import { UpdateSpecDto } from './dto/update-spec.dto';
import { SpecQueryDto } from './dto/spec-query.dto';
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
export class SpecsService {
    constructor(
        private prisma: PrismaService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        private i18nService: I18nService,
    ) {}

    private readonly CACHE_TTL = 10 * 60 * 1000;

    async create(createSpecDto: CreateSpecDto, language: Language = Language.fa) {
        return this.createSpec(createSpecDto, language);
    }

    async findAll(query: SpecQueryDto, language: Language = Language.fa) {
        return this.findSpecs(query, language);
    }

    async findOne(id: string, language: Language = Language.fa) {
        return this.findSpecById(id, language);
    }

    async findByKey(key: string, language: Language = Language.fa) {
        return this.findSpecByKey(key, language);
    }

    async update(id: string, updateSpecDto: UpdateSpecDto, language: Language = Language.fa) {
        return this.updateSpec(id, updateSpecDto, language);
    }

    async remove(id: string, language: Language = Language.fa) {
        return this.deleteSpec(id, language);
    }

    // ==================== متدهای پیاده‌سازی ====================

    private async createSpec(createSpecDto: CreateSpecDto, language: Language) {
        // بررسی تکراری نبودن key
        const existingSpec = await this.prisma.spec.findFirst({
            where: { key: createSpecDto.key },
        });

        if (existingSpec) {
            throw new I18nConflictException(
                'SPEC_ALREADY_EXISTS',
                language,
                { key: createSpecDto.key }
            );
        }

        try {
            const specData: any = {
                key: createSpecDto.key,
                type: createSpecDto.type,
                data_type: createSpecDto.data_type,
                is_required: createSpecDto.is_required,
                is_filterable: createSpecDto.is_filterable,
                is_searchable: createSpecDto.is_searchable,
                sort_order: createSpecDto.sort_order,
                options: createSpecDto.options,
                min_value: createSpecDto.min_value,
                max_value: createSpecDto.max_value,
                step: createSpecDto.step,
                allowed_unit_keys: createSpecDto.allowed_unit_keys || [],
            };

            // اگر محتوای چندزبانه ارسال شده، اضافه کن
            if (createSpecDto.contents && createSpecDto.contents.length > 0) {
                specData.contents = {
                    create: createSpecDto.contents.map(content => ({
                        language: content.language,
                        label: content.label,
                        description: content.description,
                        auto_translated: content.auto_translated || false,
                    }))
                };
            } else {
                // ایجاد محتوای پیش‌فرض
                specData.contents = {
                    create: [
                        {
                            language: Language.fa,
                            label: createSpecDto.key,
                            description: createSpecDto.data_type,
                            auto_translated: false,
                        },
                        {
                            language: Language.en,
                            label: createSpecDto.key,
                            description: createSpecDto.data_type,
                            auto_translated: true,
                        }
                    ]
                };
            }

            const spec = await this.prisma.spec.create({
                data: specData,
                include: this.getSpecInclude(language),
            });

            await this.clearSpecsCache();
            return this.mergeMultilingualContent(spec, language);

        } catch (error) {
            throw new I18nInternalServerErrorException(
                'SPEC_CREATE_ERROR',
                language
            );
        }
    }

    private async findSpecs(query: SpecQueryDto, language: Language) {
        const cacheKey = this.getSpecsCacheKey(query, language);

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            const { page = 1, limit = 50, search, type, is_filterable, is_required } = query;
            const skip = (page - 1) * limit;

            const where: any = {};

            if (type) {
                where.type = type;
            }

            if (is_filterable !== undefined) {
                where.is_filterable = is_filterable;
            }

            if (is_required !== undefined) {
                where.is_required = is_required;
            }

            if (search) {
                where.OR = [
                    {
                        contents: {
                            some: {
                                language,
                                label: { contains: search, mode: 'insensitive' }
                            }
                        }
                    },
                    { key: { contains: search, mode: 'insensitive' } },
                    { type: { contains: search, mode: 'insensitive' } }
                ];
            }

            const [specs, total] = await Promise.all([
                this.prisma.spec.findMany({
                    where,
                    skip,
                    take: limit,
                    include: this.getSpecInclude(language),
                    orderBy: { sort_order: 'asc' }
                }),
                this.prisma.spec.count({ where }),
            ]);

            const result = {
                data: specs.map(spec => this.mergeMultilingualContent(spec, language)),
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
                'SPECS_FETCH_ERROR',
                language
            );
        }
    }

    private async findSpecById(id: string, language: Language) {
        const cacheKey = `spec:${id}:${language}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            const spec = await this.prisma.spec.findUnique({
                where: { id },
                include: this.getDetailedSpecInclude(language),
            });

            if (!spec) {
                throw new I18nNotFoundException('SPEC_NOT_FOUND', language, { id });
            }

            const mergedSpec = this.mergeMultilingualContent(spec, language);
            await this.cacheManager.set(cacheKey, mergedSpec, this.CACHE_TTL);
            return mergedSpec;

        } catch (error) {
            if (error instanceof I18nNotFoundException) {
                throw error;
            }
            throw new I18nInternalServerErrorException('SPEC_FETCH_ERROR', language);
        }
    }

    private async findSpecByKey(key: string, language: Language) {
        const cacheKey = `spec:key:${key}:${language}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            const spec = await this.prisma.spec.findFirst({
                where: { key },
                include: this.getSpecInclude(language),
            });

            if (!spec) {
                throw new I18nNotFoundException('SPEC_NOT_FOUND_BY_KEY', language, { key });
            }

            const mergedSpec = this.mergeMultilingualContent(spec, language);
            await this.cacheManager.set(cacheKey, mergedSpec, this.CACHE_TTL);
            return mergedSpec;

        } catch (error) {
            if (error instanceof I18nNotFoundException) {
                throw error;
            }
            throw new I18nInternalServerErrorException('SPEC_FETCH_ERROR', language);
        }
    }

    private async updateSpec(id: string, updateSpecDto: UpdateSpecDto, language: Language) {
        const existingSpec = await this.prisma.spec.findUnique({
            where: { id },
        });

        if (!existingSpec) {
            throw new I18nNotFoundException('SPEC_NOT_FOUND', language, { id });
        }

        // بررسی key تکراری
        if (updateSpecDto.key && updateSpecDto.key !== existingSpec.key) {
            const duplicateSpec = await this.prisma.spec.findFirst({
                where: {
                    AND: [
                        { id: { not: id } },
                        { key: updateSpecDto.key }
                    ]
                },
            });

            if (duplicateSpec) {
                throw new I18nConflictException(
                    'SPEC_ALREADY_EXISTS',
                    language,
                    { key: updateSpecDto.key }
                );
            }
        }

        try {
            const updateData: any = { ...updateSpecDto };
            delete updateData.contents;

            // اگر محتوای چندزبانه برای آپدیت ارسال شده
            if (updateSpecDto.contents && updateSpecDto.contents.length > 0) {
                const updatedSpec = await this.prisma.spec.update({
                    where: { id },
                    data: updateData,
                });

                // آپدیت محتوای چندزبانه
                await Promise.all(
                    updateSpecDto.contents.map(content =>
                        this.prisma.specContent.upsert({
                            where: {
                                spec_id_language: {
                                    spec_id: id,
                                    language: content.language
                                }
                            },
                            create: {
                                spec_id: id,
                                language: content.language,
                                label: content.label,
                                description: content.description,
                                auto_translated: content.auto_translated || false,
                            },
                            update: {
                                label: content.label,
                                description: content.description,
                                auto_translated: content.auto_translated,
                            }
                        })
                    )
                );

                // دریافت Spec با محتوای به‌روز شده
                const finalSpec = await this.prisma.spec.findUnique({
                    where: { id },
                    include: this.getSpecInclude(language),
                });

                await this.clearSpecCache(id, existingSpec.key, language);
                return this.mergeMultilingualContent(finalSpec, language);

            } else {
                // آپدیت ساده بدون محتوای چندزبانه
                const updatedSpec = await this.prisma.spec.update({
                    where: { id },
                    data: updateData,
                    include: this.getSpecInclude(language),
                });

                await this.clearSpecCache(id, existingSpec.key, language);
                return this.mergeMultilingualContent(updatedSpec, language);
            }

        } catch (error) {
            if (error instanceof I18nNotFoundException || error instanceof I18nConflictException) {
                throw error;
            }
            throw new I18nInternalServerErrorException('SPEC_UPDATE_ERROR', language);
        }
    }

    private async deleteSpec(id: string, language: Language) {
        const spec = await this.prisma.spec.findUnique({
            where: { id },
            include: {
                category_specs: {
                    select: { id: true }
                },
                catalog_specs: {
                    select: { id: true }
                }
            }
        });

        if (!spec) {
            throw new I18nNotFoundException('SPEC_NOT_FOUND', language, { id });
        }

        // بررسی استفاده در CategorySpecها
        if (spec.category_specs.length > 0) {
            throw new I18nConflictException('DELETE_SPEC_WITH_CATEGORY_SPECS', language, {
                categorySpecsCount: spec.category_specs.length
            });
        }

        // بررسی استفاده در CatalogSpecها
        if (spec.catalog_specs.length > 0) {
            throw new I18nConflictException('DELETE_SPEC_WITH_CATALOG_SPECS', language, {
                catalogSpecsCount: spec.catalog_specs.length
            });
        }

        try {
            await this.prisma.spec.delete({
                where: { id },
            });

            await this.clearSpecCache(id, spec.key, language);

            return {
                message: this.i18nService.t('SPEC_DELETED_SUCCESS', language),
                success: true
            };

        } catch (error) {
            throw new I18nInternalServerErrorException('SPEC_DELETE_ERROR', language);
        }
    }

    // ==================== متدهای مدیریت محتوای چندزبانه ====================

    async createSpecContent(specId: string, contentDto: any, language: Language = Language.fa) {
        const spec = await this.prisma.spec.findUnique({
            where: { id: specId }
        });

        if (!spec) {
            throw new I18nNotFoundException('SPEC_NOT_FOUND', language, { id: specId });
        }

        try {
            const content = await this.prisma.specContent.create({
                data: {
                    spec_id: specId,
                    language: contentDto.language,
                    label: contentDto.label,
                    description: contentDto.description,
                    auto_translated: contentDto.auto_translated || false,
                }
            });

            await this.clearSpecCache(specId, spec.key, contentDto.language);
            return content;

        } catch (error) {
            throw new I18nInternalServerErrorException('SPEC_CONTENT_CREATE_ERROR', language);
        }
    }

    async getSpecTranslations(specId: string, language: Language = Language.fa) {
        try {
            return await this.prisma.specContent.findMany({
                where: { spec_id: specId },
                select: {
                    language: true,
                    label: true,
                    description: true,
                    auto_translated: true,
                }
            });
        } catch (error) {
            throw new I18nInternalServerErrorException('SPEC_TRANSLATIONS_FETCH_ERROR', language);
        }
    }

    // ==================== متدهای کمکی ====================

    private mergeMultilingualContent(spec: any, language: Language) {
        if (!spec) return spec;

        const content = spec.contents?.find((c: any) => c.language === language);

        return {
            ...spec,
            label: content?.label || spec.key,
            description: content?.description || spec.data_type,
            contents: undefined
        };
    }

    private getSpecInclude(language: Language) {
        return {
            contents: {
                where: { language }
            }
        };
    }

    private getDetailedSpecInclude(language: Language) {
        return {
            ...this.getSpecInclude(language),
            category_specs: {
                include: {
                    category: {
                        include: {
                            contents: {
                                where: { language }
                            }
                        }
                    }
                }
            },
            catalog_specs: {
                include: {
                    catalog: {
                        include: {
                            contents: {
                                where: { language }
                            }
                        }
                    }
                }
            }
        };
    }

    // ==================== مدیریت کش ====================

    private getSpecsCacheKey(query: SpecQueryDto, language: Language): string {
        return `specs:${language}:${JSON.stringify(query)}`;
    }

    private async clearSpecCache(specId: string, key: string, language?: Language) {
        const cacheKeys = [
            `spec:${specId}:${language || '*'}`,
            `spec:key:${key}:${language || '*'}`,
        ];

        await Promise.all(cacheKeys.map(cacheKey => this.cacheManager.del(cacheKey)));
        await this.clearSpecsCache(language);
    }

    private async clearSpecsCache(language?: Language) {
        try {
            const keys = ['specs:'];

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
            console.error('Error clearing specs cache:', error);
        }
    }
}