// prisma/seed-locations.ts
import { PrismaClient, LocationType, Language } from '@prisma/client';
import { iranLocationData, countriesData } from './data-location';

const prisma = new PrismaClient();

async function seedLocations() {
    console.log('🌱 Seeding locations with multilingual content...');

    try {
        // پاک کردن داده‌های قبلی با ترتیب درست
        console.log('🗑️ Cleaning up existing data...');

        // ابتدا محتوای چندزبانه را حذف کن
        await prisma.locationContent.deleteMany({});
        console.log('✅ Location contents deleted');

        // سپس لوکیشن‌ها را حذف کن
        await prisma.location.deleteMany({});
        console.log('✅ Locations deleted');

        // ایجاد کشورها
        console.log('🏴 Creating countries...');

        const iran = await prisma.location.create({
            data: {
                type: LocationType.COUNTRY,
                code: 'IR',
                contents: {
                    create: [
                        {
                            language: Language.fa,
                            name: 'ایران',
                            full_name: 'جمهوری اسلامی ایران',
                            auto_translated: false
                        },
                        {
                            language: Language.en,
                            name: 'Iran',
                            full_name: 'Islamic Republic of Iran',
                            auto_translated: false
                        },
                        {
                            language: Language.ar,
                            name: 'إيران',
                            full_name: 'جمهورية إيران الإسلامية',
                            auto_translated: true
                        }
                    ]
                }
            }
        });
        console.log(`✅ Country "ایران" created (ID: ${iran.id})`);

        const ireland = await prisma.location.create({
            data: {
                type: LocationType.COUNTRY,
                code: 'IE',
                contents: {
                    create: [
                        {
                            language: Language.fa,
                            name: 'ایرلند',
                            full_name: 'جمهوری ایرلند',
                            auto_translated: false
                        },
                        {
                            language: Language.en,
                            name: 'Ireland',
                            full_name: 'Republic of Ireland',
                            auto_translated: false
                        },
                        {
                            language: Language.ar,
                            name: 'أيرلندا',
                            full_name: 'جمهورية أيرلندا',
                            auto_translated: true
                        }
                    ]
                }
            }
        });
        console.log(`✅ Country "ایرلند" created (ID: ${ireland.id})`);

        // ایجاد استان‌های ایران
        console.log('🏞️ Creating provinces of Iran...');

        const provinceLocations: { [key: number]: string } = {};
        let totalCities = 0;

        for (const provinceData of iranLocationData) {
            const province = await prisma.location.create({
                data: {
                    type: LocationType.PROVINCE,
                    code: `IR-${provinceData.id.toString().padStart(2, '0')}`,
                    parent_id: iran.id,
                    contents: {
                        create: [
                            {
                                language: Language.fa,
                                name: provinceData.province_name,
                                full_name: `استان ${provinceData.province_name}`,
                                auto_translated: false
                            },
                            {
                                language: Language.en,
                                name: provinceData.province_en_name,
                                full_name: `${provinceData.province_en_name} Province`,
                                auto_translated: false
                            },
                            {
                                language: Language.ar,
                                name: provinceData.province_name,
                                full_name: `محافظة ${provinceData.province_name}`,
                                auto_translated: true
                            }
                        ]
                    }
                }
            });

            provinceLocations[provinceData.id] = province.id;
            console.log(`✅ Province "${provinceData.province_name}" created (ID: ${province.id})`);

            // ایجاد شهرهای این استان
            console.log(`  🏙️ Creating cities for ${provinceData.province_name}...`);

            const cities = Array.isArray(provinceData.cities)
                ? provinceData.cities
                : Object.values(provinceData.cities);

            const cityCreations = [];

            for (const cityData of cities) {
                if (!cityData.city_name || !cityData.city_en_name) continue;

                cityCreations.push(
                    prisma.location.create({
                        data: {
                            type: LocationType.CITY,
                            code: `IR-${provinceData.id.toString().padStart(2, '0')}-${cityData.id.toString().padStart(3, '0')}`,
                            parent_id: province.id,
                            contents: {
                                create: [
                                    {
                                        language: Language.fa,
                                        name: cityData.city_name.trim(),
                                        full_name: `شهر ${cityData.city_name.trim()}`,
                                        auto_translated: false
                                    },
                                    {
                                        language: Language.en,
                                        name: cityData.city_en_name.trim(),
                                        full_name: `${cityData.city_en_name.trim()} City`,
                                        auto_translated: false
                                    },
                                    {
                                        language: Language.ar,
                                        name: cityData.city_name.trim(),
                                        full_name: `مدينة ${cityData.city_name.trim()}`,
                                        auto_translated: true
                                    }
                                ]
                            }
                        }
                    })
                );
            }

            const createdCities = await Promise.all(cityCreations);
            totalCities += createdCities.length;
            console.log(`  ✅ ${createdCities.length} cities created for ${provinceData.province_name}`);
        }

        // ایجاد شهرهای مهم ایرلند
        console.log('🍀 Creating major cities of Ireland...');

        const irelandCities = [
            { name: 'دوبلین', en_name: 'Dublin', code: 'IE-DUB' },
            { name: 'کورک', en_name: 'Cork', code: 'IE-COR' },
            { name: 'گالوی', en_name: 'Galway', code: 'IE-GAL' },
            { name: 'لیمریک', en_name: 'Limerick', code: 'IE-LIM' },
            { name: 'واترفورد', en_name: 'Waterford', code: 'IE-WAT' }
        ];

        const irelandCityCreations = irelandCities.map(cityData =>
            prisma.location.create({
                data: {
                    type: LocationType.CITY,
                    code: cityData.code,
                    parent_id: ireland.id,
                    contents: {
                        create: [
                            {
                                language: Language.fa,
                                name: cityData.name,
                                full_name: `شهر ${cityData.name}`,
                                auto_translated: false
                            },
                            {
                                language: Language.en,
                                name: cityData.en_name,
                                full_name: `${cityData.en_name} City`,
                                auto_translated: false
                            },
                            {
                                language: Language.ar,
                                name: cityData.name,
                                full_name: `مدينة ${cityData.name}`,
                                auto_translated: true
                            }
                        ]
                    }
                }
            })
        );

        await Promise.all(irelandCityCreations);
        console.log(`✅ ${irelandCities.length} cities of Ireland created`);

        console.log('🎉 Locations seeding completed successfully!');
        console.log('📊 Summary:');
        console.log(`   - 2 countries (Iran, Ireland)`);
        console.log(`   - ${iranLocationData.length} provinces of Iran`);
        console.log(`   - ${totalCities} cities of Iran`);
        console.log(`   - ${irelandCities.length} major cities of Ireland`);
        console.log(`   - All locations have multilingual content (FA, EN, AR)`);

    } catch (error) {
        console.error('❌ Error seeding locations:', error);
        throw error;
    }
}

// نسخه ایمن برای حذف داده‌ها
async function cleanupLocations() {
    console.log('🧹 Cleaning up location data...');

    try {
        // استفاده از تراکنش برای اطمینان از حذف کامل
        await prisma.$transaction(async (tx) => {
            // ابتدا محتوای چندزبانه را حذف کن
            await tx.locationContent.deleteMany({});
            console.log('✅ Location contents deleted');

            // سپس لوکیشن‌ها را حذف کن
            await tx.location.deleteMany({});
            console.log('✅ Locations deleted');
        });

        console.log('✅ Location data cleanup completed');
    } catch (error) {
        console.error('❌ Error cleaning up location data:', error);
        throw error;
    }
}

// برای اجرای مستقل
if (require.main === module) {
    seedLocations()
        .catch((error) => {
            console.error('Failed to seed locations:', error);
            process.exit(1);
        })
        .finally(async () => {
            await prisma.$disconnect();
        });
}

export { seedLocations, cleanupLocations };