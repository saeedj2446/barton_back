// src/units/units.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { UnitQueryDto } from './dto/unit-query.dto';
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
export class UnitsService {
    constructor(
        private prisma: PrismaService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        private i18nService: I18nService,
    ) {}

    private readonly CACHE_TTL = 10 * 60 * 1000;

    async create(createUnitDto: CreateUnitDto, language: Language = Language.fa) {
        return this.createUnit(createUnitDto, language);
    }

    async findAll(query: UnitQueryDto, language: Language = Language.fa) {
        return this.findUnits(query, language);
    }

    async findOne(id: string, language: Language = Language.fa) {
        return this.findUnitById(id, language);
    }

    async findByKey(key: string, language: Language = Language.fa) {
        return this.findUnitByKey(key, language);
    }

    async update(id: string, updateUnitDto: UpdateUnitDto, language: Language = Language.fa) {
        return this.updateUnit(id, updateUnitDto, language);
    }

    async remove(id: string, language: Language = Language.fa) {
        return this.deleteUnit(id, language);
    }

    // ==================== متدهای پیاده‌سازی ====================

    private async createUnit(createUnitDto: CreateUnitDto, language: Language) {
        // بررسی تکراری نبودن key
        const existingUnit = await this.prisma.unit.findFirst({
            where: { key: createUnitDto.key },
        });

        if (existingUnit) {
            throw new I18nConflictException(
                'UNIT_ALREADY_EXISTS',
                language,
                { key: createUnitDto.key }
            );
        }

        try {
            const unitData: any = {
                key: createUnitDto.key,
                symbol: createUnitDto.symbol,
                rate: createUnitDto.rate,
                isBase: createUnitDto.isBase,
            };

            // اگر محتوای چندزبانه ارسال شده، اضافه کن
            if (createUnitDto.contents && createUnitDto.contents.length > 0) {
                unitData.contents = {
                    create: createUnitDto.contents.map(content => ({
                        language: content.language,
                        label: content.label,
                        auto_translated: content.auto_translated || false,
                    }))
                };
            } else {
                // ایجاد محتوای پیش‌فرض
                unitData.contents = {
                    create: [
                        {
                            language: Language.fa,
                            label: createUnitDto.symbol,
                            auto_translated: false,
                        },
                        {
                            language: Language.en,
                            label: createUnitDto.symbol,
                            auto_translated: true,
                        }
                    ]
                };
            }

            const unit = await this.prisma.unit.create({
                data: unitData,
                include: this.getUnitInclude(language),
            });

            await this.clearUnitsCache();
            return this.mergeMultilingualContent(unit, language);

        } catch (error) {
            throw new I18nInternalServerErrorException(
                'UNIT_CREATE_ERROR',
                language
            );
        }
    }

    private async findUnits(query: UnitQueryDto, language: Language) {
        const cacheKey = this.getUnitsCacheKey(query, language);

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            const { page = 1, limit = 50, search, isBase } = query;
            const skip = (page - 1) * limit;

            const where: any = {};

            if (isBase !== undefined) {
                where.isBase = isBase;
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
                    { symbol: { contains: search, mode: 'insensitive' } }
                ];
            }

            const [units, total] = await Promise.all([
                this.prisma.unit.findMany({
                    where,
                    skip,
                    take: limit,
                    include: this.getUnitInclude(language),
                    orderBy: { key: 'asc' }
                }),
                this.prisma.unit.count({ where }),
            ]);

            const result = {
                data: units.map(unit => this.mergeMultilingualContent(unit, language)),
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
                'UNITS_FETCH_ERROR',
                language
            );
        }
    }

    private async findUnitById(id: string, language: Language) {
        const cacheKey = `unit:${id}:${language}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            const unit = await this.prisma.unit.findUnique({
                where: { id },
                include: this.getUnitInclude(language),
            });

            if (!unit) {
                throw new I18nNotFoundException('UNIT_NOT_FOUND', language, { id });
            }

            const mergedUnit = this.mergeMultilingualContent(unit, language);
            await this.cacheManager.set(cacheKey, mergedUnit, this.CACHE_TTL);
            return mergedUnit;

        } catch (error) {
            if (error instanceof I18nNotFoundException) {
                throw error;
            }
            throw new I18nInternalServerErrorException('UNIT_FETCH_ERROR', language);
        }
    }

    private async findUnitByKey(key: string, language: Language) {
        const cacheKey = `unit:key:${key}:${language}`;

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            const unit = await this.prisma.unit.findFirst({
                where: { key },
                include: this.getUnitInclude(language),
            });

            if (!unit) {
                throw new I18nNotFoundException('UNIT_NOT_FOUND_BY_KEY', language, { key });
            }

            const mergedUnit = this.mergeMultilingualContent(unit, language);
            await this.cacheManager.set(cacheKey, mergedUnit, this.CACHE_TTL);
            return mergedUnit;

        } catch (error) {
            if (error instanceof I18nNotFoundException) {
                throw error;
            }
            throw new I18nInternalServerErrorException('UNIT_FETCH_ERROR', language);
        }
    }

    private async updateUnit(id: string, updateUnitDto: UpdateUnitDto, language: Language) {
        const existingUnit = await this.prisma.unit.findUnique({
            where: { id },
        });

        if (!existingUnit) {
            throw new I18nNotFoundException('UNIT_NOT_FOUND', language, { id });
        }

        // بررسی key تکراری
        if (updateUnitDto.key && updateUnitDto.key !== existingUnit.key) {
            const duplicateUnit = await this.prisma.unit.findFirst({
                where: {
                    AND: [
                        { id: { not: id } },
                        { key: updateUnitDto.key }
                    ]
                },
            });

            if (duplicateUnit) {
                throw new I18nConflictException(
                    'UNIT_ALREADY_EXISTS',
                    language,
                    { key: updateUnitDto.key }
                );
            }
        }

        try {
            const updateData: any = { ...updateUnitDto };
            delete updateData.contents;

            // اگر محتوای چندزبانه برای آپدیت ارسال شده
            if (updateUnitDto.contents && updateUnitDto.contents.length > 0) {
                const updatedUnit = await this.prisma.unit.update({
                    where: { id },
                    data: updateData,
                });

                // آپدیت محتوای چندزبانه
                await Promise.all(
                    updateUnitDto.contents.map(content =>
                        this.prisma.unitContent.upsert({
                            where: {
                                unit_id_language: {
                                    unit_id: id,
                                    language: content.language
                                }
                            },
                            create: {
                                unit_id: id,
                                language: content.language,
                                label: content.label,
                                auto_translated: content.auto_translated || false,
                            },
                            update: {
                                label: content.label,
                                auto_translated: content.auto_translated,
                            }
                        })
                    )
                );

                // دریافت واحد با محتوای به‌روز شده
                const finalUnit = await this.prisma.unit.findUnique({
                    where: { id },
                    include: this.getUnitInclude(language),
                });

                await this.clearUnitCache(id, existingUnit.key, language);
                return this.mergeMultilingualContent(finalUnit, language);

            } else {
                // آپدیت ساده بدون محتوای چندزبانه
                const updatedUnit = await this.prisma.unit.update({
                    where: { id },
                    data: updateData,
                    include: this.getUnitInclude(language),
                });

                await this.clearUnitCache(id, existingUnit.key, language);
                return this.mergeMultilingualContent(updatedUnit, language);
            }

        } catch (error) {
            if (error instanceof I18nNotFoundException || error instanceof I18nConflictException) {
                throw error;
            }
            throw new I18nInternalServerErrorException('UNIT_UPDATE_ERROR', language);
        }
    }

    private async deleteUnit(id: string, language: Language) {
        const unit = await this.prisma.unit.findUnique({
            where: { id },
        });

        if (!unit) {
            throw new I18nNotFoundException('UNIT_NOT_FOUND', language, { id });
        }

        // بررسی استفاده در Specها
        const specUsage = await this.prisma.spec.count({
            where: {
                allowed_unit_keys: {
                    has: unit.key
                }
            }
        });

        if (specUsage > 0) {
            throw new I18nConflictException('DELETE_UNIT_IN_USE', language, {
                usageCount: specUsage
            });
        }

        try {
            await this.prisma.unit.delete({
                where: { id },
            });

            await this.clearUnitCache(id, unit.key, language);

            return {
                message: this.i18nService.t('UNIT_DELETED_SUCCESS', language),
                success: true
            };

        } catch (error) {
            throw new I18nInternalServerErrorException('UNIT_DELETE_ERROR', language);
        }
    }

    // ==================== متدهای کمکی ====================

    private mergeMultilingualContent(unit: any, language: Language) {
        if (!unit) return unit;

        const content = unit.contents?.find((c: any) => c.language === language);

        return {
            ...unit,
            label: content?.label || unit.symbol,
            contents: undefined
        };
    }

    private getUnitInclude(language: Language) {
        return {
            contents: {
                where: { language }
            }
        };
    }

    // ==================== مدیریت کش ====================

    private getUnitsCacheKey(query: UnitQueryDto, language: Language): string {
        return `units:${language}:${JSON.stringify(query)}`;
    }

    private async clearUnitCache(unitId: string, key: string, language?: Language) {
        const cacheKeys = [
            `unit:${unitId}:${language || '*'}`,
            `unit:key:${key}:${language || '*'}`,
        ];

        await Promise.all(cacheKeys.map(cacheKey => this.cacheManager.del(cacheKey)));
        await this.clearUnitsCache(language);
    }

    private async clearUnitsCache(language?: Language) {
        try {
            const keys = ['units:'];

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
            console.error('Error clearing units cache:', error);
        }
    }
}