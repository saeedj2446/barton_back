// src/locations/locations.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { LocationQueryDto } from './dto/location-query.dto';
import { CreateLocationContentDto, UpdateLocationContentDto } from './dto/location-content.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { LocationType, Language } from '@prisma/client';
import { I18nService } from '../i18n/i18n.service';
import {
    I18nNotFoundException,
    I18nConflictException,
    I18nInternalServerErrorException,
} from '../common/exceptions/i18n-exceptions';

@Injectable()
export class LocationsService {
    constructor(
        private prisma: PrismaService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        private i18nService: I18nService,
    ) {}

    private readonly CACHE_TTL = 10 * 60 * 1000; // 10 minutes

    // ==================== Public Methods ====================

    async create(createLocationDto: CreateLocationDto, language: Language = Language.fa) {
        return this.createLocation(createLocationDto, language);
    }

    async findAll(query: LocationQueryDto, language: Language = Language.fa) {
        return this.findLocations(query, language);
    }

    async findOne(id: string, language: Language = Language.fa) {
        return this.findLocationById(id, language);
    }

    async findByCode(code: string, language: Language = Language.fa) {
        return this.findLocationByCode(code, language);
    }

    async update(id: string, updateLocationDto: UpdateLocationDto, language: Language = Language.fa) {
        return this.updateLocation(id, updateLocationDto, language);
    }

    async remove(id: string, language: Language = Language.fa) {
        return this.deleteLocation(id, language);
    }

    async getLocationTree(parentId: string | null = null, language: Language = Language.fa) {
        return this.getTree(parentId, language);
    }

    async getChildren(parentId?: string, language: Language = Language.fa) {
        return this.getLocationChildren(parentId, language);
    }

    async getByType(type: LocationType, language: Language = Language.fa) {
        return this.getLocationsByType(type, language);
    }

    // ==================== Core Implementation Methods ====================

    private async createLocation(createLocationDto: CreateLocationDto, language: Language) {
        // Check for duplicate code
        const existingLocation = await this.prisma.location.findFirst({
            where: { code: createLocationDto.code },
        });

        if (existingLocation) {
            throw new I18nConflictException(
                'LOCATION_ALREADY_EXISTS',
                language,
                { code: createLocationDto.code }
            );
        }

        // Validate parent_id if provided
        if (createLocationDto.parent_id) {
            const parentLocation = await this.prisma.location.findUnique({
                where: { id: createLocationDto.parent_id },
            });

            if (!parentLocation) {
                throw new I18nNotFoundException(
                    'PARENT_LOCATION_NOT_FOUND',
                    language,
                    { parentId: createLocationDto.parent_id }
                );
            }
        }

        try {
            const location = await this.prisma.location.create({
                data: {
                    type: createLocationDto.type,
                    code: createLocationDto.code,
                    parent_id: createLocationDto.parent_id,
                    contents: {
                        create: createLocationDto.contents.map(content => ({
                            language: content.language,
                            name: content.name,
                            full_name: content.full_name,
                            auto_translated: content.auto_translated || false,
                        }))
                    }
                },
                include: this.getLocationInclude(language),
            });

            await this.clearLocationsCache();
            return this.mergeMultilingualContent(location, language);

        } catch (error) {
            console.error('Create location error:', error);
            throw new I18nInternalServerErrorException(
                'LOCATION_CREATE_ERROR',
                language
            );
        }
    }

    private async findLocations(query: LocationQueryDto, language: Language) {
        const cacheKey = this.getLocationsCacheKey(query, language);

        try {
            const cached = await this.cacheManager.get(cacheKey);
            if (cached) {
                return cached;
            }
        } catch (cacheError) {
            console.warn('Cache get error:', cacheError);
        }

        try {
            const { page = 1, limit = 50, search, type, parent_id } = query;
            const skip = (page - 1) * limit;

            const where: any = {};

            if (type) {
                where.type = type;
            }

            if (parent_id !== undefined) {
                where.parent_id = parent_id === 'null' ? null : parent_id;
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
                    {
                        contents: {
                            some: {
                                language,
                                full_name: { contains: search, mode: 'insensitive' }
                            }
                        }
                    },
                    { code: { contains: search, mode: 'insensitive' } }
                ];
            }

            const [locations, total] = await Promise.all([
                this.prisma.location.findMany({
                    where,
                    skip,
                    take: limit,
                    include: this.getLocationInclude(language),
                    orderBy: { code: 'asc' }
                }),
                this.prisma.location.count({ where }),
            ]);

            const result = {
                data: locations.map(location => this.mergeMultilingualContent(location, language)),
                meta: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            };

            try {
                await this.cacheManager.set(cacheKey, result, this.CACHE_TTL);
            } catch (cacheError) {
                console.warn('Cache set error:', cacheError);
            }

            return result;

        } catch (error) {
            console.error('Find locations error:', error);
            throw new I18nInternalServerErrorException(
                'LOCATIONS_FETCH_ERROR',
                language
            );
        }
    }

    private async findLocationById(id: string, language: Language) {
        const cacheKey = `location:${id}:${language}`;

        try {
            const cached = await this.cacheManager.get(cacheKey);
            if (cached) {
                return cached;
            }
        } catch (cacheError) {
            console.warn('Cache get error:', cacheError);
        }

        try {
            const location = await this.prisma.location.findUnique({
                where: { id },
                include: this.getLocationInclude(language),
            });

            if (!location) {
                throw new I18nNotFoundException('LOCATION_NOT_FOUND', language, { id });
            }

            const mergedLocation = this.mergeMultilingualContent(location, language);

            try {
                await this.cacheManager.set(cacheKey, mergedLocation, this.CACHE_TTL);
            } catch (cacheError) {
                console.warn('Cache set error:', cacheError);
            }

            return mergedLocation;

        } catch (error) {
            if (error instanceof I18nNotFoundException) {
                throw error;
            }
            console.error('Find location by ID error:', error);
            throw new I18nInternalServerErrorException('LOCATION_FETCH_ERROR', language);
        }
    }

    private async findLocationByCode(code: string, language: Language) {
        const cacheKey = `location:code:${code}:${language}`;

        try {
            const cached = await this.cacheManager.get(cacheKey);
            if (cached) {
                return cached;
            }
        } catch (cacheError) {
            console.warn('Cache get error:', cacheError);
        }

        try {
            const location = await this.prisma.location.findFirst({
                where: { code },
                include: this.getLocationInclude(language),
            });

            if (!location) {
                throw new I18nNotFoundException('LOCATION_NOT_FOUND_BY_CODE', language, { code });
            }

            const mergedLocation = this.mergeMultilingualContent(location, language);

            try {
                await this.cacheManager.set(cacheKey, mergedLocation, this.CACHE_TTL);
            } catch (cacheError) {
                console.warn('Cache set error:', cacheError);
            }

            return mergedLocation;

        } catch (error) {
            if (error instanceof I18nNotFoundException) {
                throw error;
            }
            console.error('Find location by code error:', error);
            throw new I18nInternalServerErrorException('LOCATION_FETCH_ERROR', language);
        }
    }

    private async updateLocation(id: string, updateLocationDto: UpdateLocationDto, language: Language) {
        const existingLocation = await this.prisma.location.findUnique({
            where: { id },
        });

        if (!existingLocation) {
            throw new I18nNotFoundException('LOCATION_NOT_FOUND', language, { id });
        }

        // Check for duplicate code
        if (updateLocationDto.code && updateLocationDto.code !== existingLocation.code) {
            const duplicateLocation = await this.prisma.location.findFirst({
                where: {
                    code: updateLocationDto.code,
                    NOT: { id }
                },
            });

            if (duplicateLocation) {
                throw new I18nConflictException(
                    'LOCATION_ALREADY_EXISTS',
                    language,
                    { code: updateLocationDto.code }
                );
            }
        }

        // Validate parent_id
        if (updateLocationDto.parent_id !== undefined) {
            if (updateLocationDto.parent_id === null) {
                // Allow setting parent_id to null
            } else {
                const parentLocation = await this.prisma.location.findUnique({
                    where: { id: updateLocationDto.parent_id },
                });

                if (!parentLocation) {
                    throw new I18nNotFoundException(
                        'PARENT_LOCATION_NOT_FOUND',
                        language,
                        { parentId: updateLocationDto.parent_id }
                    );
                }
            }
        }

        try {
            // Prepare update data
            const { contents, ...updateData } = updateLocationDto;

            let updatedLocation;

            if (contents && contents.length > 0) {
                // Update location and contents in transaction
                updatedLocation = await this.prisma.$transaction(async (tx) => {
                    // Update location
                    const location = await tx.location.update({
                        where: { id },
                        data: updateData,
                    });

                    // Update or create contents
                    await Promise.all(
                        contents.map(content =>
                            tx.locationContent.upsert({
                                where: {
                                    location_id_language: {
                                        location_id: id,
                                        language: content.language
                                    }
                                },
                                create: {
                                    location_id: id,
                                    language: content.language,
                                    name: content.name,
                                    full_name: content.full_name,
                                    auto_translated: content.auto_translated || false,
                                },
                                update: {
                                    name: content.name,
                                    full_name: content.full_name,
                                    auto_translated: content.auto_translated,
                                }
                            })
                        )
                    );

                    return location;
                });

                // Fetch the complete updated location with includes
                updatedLocation = await this.prisma.location.findUnique({
                    where: { id },
                    include: this.getLocationInclude(language),
                });
            } else {
                // Simple update without contents
                updatedLocation = await this.prisma.location.update({
                    where: { id },
                    data: updateData,
                    include: this.getLocationInclude(language),
                });
            }

            await this.clearLocationCache(id, existingLocation.code, language);
            return this.mergeMultilingualContent(updatedLocation, language);

        } catch (error) {
            if (error instanceof I18nNotFoundException || error instanceof I18nConflictException) {
                throw error;
            }
            console.error('Update location error:', error);
            throw new I18nInternalServerErrorException('LOCATION_UPDATE_ERROR', language);
        }
    }

    private async deleteLocation(id: string, language: Language) {
        const location = await this.prisma.location.findUnique({
            where: { id },
        });

        if (!location) {
            throw new I18nNotFoundException('LOCATION_NOT_FOUND', language, { id });
        }

        // Check if location has children
        const childrenCount = await this.prisma.location.count({
            where: { parent_id: id },
        });

        if (childrenCount > 0) {
            throw new I18nConflictException('DELETE_LOCATION_WITH_CHILDREN', language);
        }

        // Check usage in other entities
        const usageCount = await this.checkLocationUsage(id);
        if (usageCount > 0) {
            throw new I18nConflictException('LOCATION_IN_USE', language);
        }

        try {
            await this.prisma.location.delete({
                where: { id },
            });

            await this.clearLocationCache(id, location.code, language);

            return {
                message: this.i18nService.t('LOCATION_DELETED_SUCCESS', language),
                success: true
            };

        } catch (error) {
            console.error('Delete location error:', error);
            throw new I18nInternalServerErrorException('LOCATION_DELETE_ERROR', language);
        }
    }

    private async getTree(parentId: string | null = null, language: Language) {
        const cacheKey = `location_tree:${parentId || 'root'}:${language}`;

        try {
            const cached = await this.cacheManager.get(cacheKey);
            if (cached) {
                return cached;
            }
        } catch (cacheError) {
            console.warn('Cache get error:', cacheError);
        }

        try {
            const locations = await this.prisma.location.findMany({
                where: { parent_id: parentId },
                include: this.getLocationInclude(language),
                orderBy: { code: 'asc' }
            });

            const mergedLocations = locations.map(location =>
                this.mergeMultilingualContent(location, language)
            );

            try {
                await this.cacheManager.set(cacheKey, mergedLocations, this.CACHE_TTL);
            } catch (cacheError) {
                console.warn('Cache set error:', cacheError);
            }

            return mergedLocations;

        } catch (error) {
            console.error('Get tree error:', error);
            throw new I18nInternalServerErrorException('LOCATION_TREE_FETCH_ERROR', language);
        }
    }

    private async getLocationChildren(parentId: string | undefined, language: Language) {
        const cacheKey = `locations_children:${parentId || 'root'}:${language}`;

        try {
            const cached = await this.cacheManager.get(cacheKey);
            if (cached) {
                return cached;
            }
        } catch (cacheError) {
            console.warn('Cache get error:', cacheError);
        }

        try {
            const where: any = {};
            if (parentId === undefined || parentId === 'null' || parentId === 'undefined') {
                where.parent_id = null;
            } else {
                where.parent_id = parentId;
            }

            const locations = await this.prisma.location.findMany({
                where,
                include: this.getLocationInclude(language),
                orderBy: { code: 'asc' }
            });

            const mergedLocations = locations.map(location =>
                this.mergeMultilingualContent(location, language)
            );

            try {
                await this.cacheManager.set(cacheKey, mergedLocations, this.CACHE_TTL);
            } catch (cacheError) {
                console.warn('Cache set error:', cacheError);
            }

            return mergedLocations;

        } catch (error) {
            console.error('Get location children error:', error);
            throw new I18nInternalServerErrorException('LOCATION_CHILDREN_FETCH_ERROR', language);
        }
    }

    private async getLocationsByType(type: LocationType, language: Language) {
        const cacheKey = `locations:type:${type}:${language}`;

        try {
            const cached = await this.cacheManager.get(cacheKey);
            if (cached) {
                return cached;
            }
        } catch (cacheError) {
            console.warn('Cache get error:', cacheError);
        }

        try {
            const locations = await this.prisma.location.findMany({
                where: { type },
                include: this.getLocationInclude(language),
                orderBy: { code: 'asc' }
            });

            const mergedLocations = locations.map(location =>
                this.mergeMultilingualContent(location, language)
            );

            try {
                await this.cacheManager.set(cacheKey, mergedLocations, this.CACHE_TTL);
            } catch (cacheError) {
                console.warn('Cache set error:', cacheError);
            }

            return mergedLocations;

        } catch (error) {
            console.error('Get locations by type error:', error);
            throw new I18nInternalServerErrorException('LOCATIONS_BY_TYPE_FETCH_ERROR', language);
        }
    }

    // ==================== Multilingual Content Management ====================

    async createLocationContent(locationId: string, contentDto: CreateLocationContentDto, language: Language = Language.fa) {
        const location = await this.prisma.location.findUnique({
            where: { id: locationId }
        });

        if (!location) {
            throw new I18nNotFoundException('LOCATION_NOT_FOUND', language, { id: locationId });
        }

        try {
            const content = await this.prisma.locationContent.create({
                data: {
                    location_id: locationId,
                    language: contentDto.language,
                    name: contentDto.name,
                    full_name: contentDto.full_name,
                    auto_translated: contentDto.auto_translated || false,
                }
            });

            await this.clearLocationCache(locationId, location.code, contentDto.language);
            return content;

        } catch (error) {
            console.error('Create location content error:', error);
            throw new I18nInternalServerErrorException('LOCATION_CONTENT_CREATE_ERROR', language);
        }
    }

    async updateLocationContent(locationId: string, language: Language, contentDto: UpdateLocationContentDto) {
        const location = await this.prisma.location.findUnique({
            where: { id: locationId }
        });

        if (!location) {
            throw new I18nNotFoundException('LOCATION_NOT_FOUND', language, { id: locationId });
        }

        try {
            const content = await this.prisma.locationContent.update({
                where: {
                    location_id_language: {
                        location_id: locationId,
                        language
                    }
                },
                data: contentDto
            });

            await this.clearLocationCache(locationId, location.code, language);
            return content;

        } catch (error) {
            console.error('Update location content error:', error);
            throw new I18nInternalServerErrorException('LOCATION_CONTENT_UPDATE_ERROR', language);
        }
    }

    async getLocationTranslations(locationId: string, language: Language = Language.fa) {
        try {
            return await this.prisma.locationContent.findMany({
                where: { location_id: locationId },
                select: {
                    language: true,
                    name: true,
                    full_name: true,
                    auto_translated: true,
                }
            });
        } catch (error) {
            console.error('Get location translations error:', error);
            throw new I18nInternalServerErrorException('LOCATION_TRANSLATIONS_FETCH_ERROR', language);
        }
    }

    // ==================== Helper Methods ====================

    private async checkLocationUsage(locationId: string): Promise<number> {
        try {
            const usageChecks = await Promise.all([
                this.prisma.user.count({
                    where: {
                        OR: [
                            { location_level_1_id: locationId },
                            { location_level_2_id: locationId },
                            { location_level_3_id: locationId },
                            { location_level_4_id: locationId },
                        ]
                    },
                }),
                this.prisma.account.count({
                    where: {
                        OR: [
                            { location_level_1_id: locationId },
                            { location_level_2_id: locationId },
                            { location_level_3_id: locationId },
                            { location_level_4_id: locationId },
                        ]
                    },
                }),
                this.prisma.product.count({
                    where: {
                        OR: [
                            { location_level_1_id: locationId },
                            { location_level_2_id: locationId },
                            { location_level_3_id: locationId },
                            { location_level_4_id: locationId },
                        ]
                    },
                }),
            ]);

            return usageChecks.reduce((sum, count) => sum + count, 0);
        } catch (error) {
            console.error('Check location usage error:', error);
            return 0;
        }
    }

    private mergeMultilingualContent(location: any, language: Language) {
        if (!location) return location;

        const content = location.contents?.find((c: any) => c.language === language);

        // Remove contents from the main object to avoid duplication
        const { contents, ...locationWithoutContents } = location;

        if (!content) {
            return {
                ...locationWithoutContents,
                name: this.i18nService.t('NO_TRANSLATION_AVAILABLE', language),
                full_name: this.i18nService.t('NO_TRANSLATION_AVAILABLE', language),
            };
        }

        return {
            ...locationWithoutContents,
            name: content.name,
            full_name: content.full_name,
        };
    }

    private getLocationInclude(language: Language) {
        return {
            contents: {
                where: { language },
            },
           /* parent: {
                include: {
                    contents: {
                        where: { language }
                    }
                }
            },*/
            _count: {
                select: {
                    children: true,
                }
            }
        };
    }

    // ==================== Cache Management ====================

    private getLocationsCacheKey(query: LocationQueryDto, language: Language): string {
        const { page, limit, search, type, parent_id } = query;
        return `locations:${language}:page=${page}&limit=${limit}&search=${search || ''}&type=${type || ''}&parent_id=${parent_id || ''}`;
    }

    private async clearLocationCache(locationId: string, code: string, language?: Language) {
        const cacheKeys = [];

        if (language) {
            cacheKeys.push(
                `location:${locationId}:${language}`,
                `location:code:${code}:${language}`
            );
        } else {
            // Clear for all languages
            Object.values(Language).forEach(lang => {
                cacheKeys.push(
                    `location:${locationId}:${lang}`,
                    `location:code:${code}:${lang}`
                );
            });
        }

        // Clear pattern-based cache keys
        cacheKeys.push(
            `location_tree:${locationId}:*`,
            `locations_children:${locationId}:*`,
            `locations:type:*`,
            `locations:*`
        );

        try {
            await Promise.all(cacheKeys.map(key => this.cacheManager.del(key)));
        } catch (error) {
            console.warn('Clear location cache error:', error);
        }

        await this.clearLocationsCache();
    }

    private async clearLocationsCache() {
        const patternKeys = [
            'locations:*',
            'location_tree:*',
            'locations_children:*',
            'location:code:*',
        ];

        try {
            await Promise.all(patternKeys.map(pattern => this.cacheManager.del(pattern)));
        } catch (error) {
            console.warn('Clear locations cache error:', error);
        }
    }
}