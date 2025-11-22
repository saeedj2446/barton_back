// prisma/seed-categories.ts
import { PrismaClient, Language, SellUnit } from '@prisma/client';

const prisma = new PrismaClient();

async function categories_seed() {
    console.log('🌱 Seeding categories: agriculture -> dried_fruits -> pistachio...');

    // پاک کردن داده‌های قبلی (اختیاری)
    await prisma.categoryContent.deleteMany({});
    await prisma.category.deleteMany({});

    // ایجاد دسته‌بندی کشاورزی (والد اصلی)
    const agricultureCategory = await prisma.category.create({
        data: {
            bId: 1,
            sellUnits: [SellUnit.KILOGRAM, SellUnit.TON, SellUnit.GRAM],
            contents: {
                create: [
                    {
                        language: Language.fa,
                        name: 'محصولات کشاورزی',
                        description: 'کلیه محصولات کشاورزی و باغی',
                        auto_translated: false
                    },
                    {
                        language: Language.en,
                        name: 'Agricultural Products',
                        description: 'All agricultural and garden products',
                        auto_translated: false
                    },
                    {
                        language: Language.ar,
                        name: 'المنتجات الزراعية',
                        description: 'جميع المنتجات الزراعية والبستانية',
                        auto_translated: true
                    }
                ]
            }
        }
    });
    console.log(`✅ Category "محصولات کشاورزی" seeded (ID: ${agricultureCategory.id})`);

    // ایجاد دسته‌بندی خشکبار (فرزند کشاورزی)
    const driedFruitsCategory = await prisma.category.create({
        data: {
            bId: 2,
            sellUnits: [SellUnit.KILOGRAM, SellUnit.GRAM, SellUnit.BOX, SellUnit.PACKAGE],
            parent_id: agricultureCategory.id,
            contents: {
                create: [
                    {
                        language: Language.fa,
                        name: 'خشکبار و آجیل',
                        description: 'انواع خشکبار، آجیل و مغزها',
                        auto_translated: false
                    },
                    {
                        language: Language.en,
                        name: 'Dried Fruits & Nuts',
                        description: 'Various dried fruits, nuts and kernels',
                        auto_translated: false
                    },
                    {
                        language: Language.ar,
                        name: 'الفواكه المجففة والمكسرات',
                        description: 'مختلف الفواكه المجففة والمكسرات والنواة',
                        auto_translated: true
                    }
                ]
            }
        }
    });
    console.log(`✅ Category "خشکبار و آجیل" seeded (ID: ${driedFruitsCategory.id})`);

    // ایجاد دسته‌بندی پسته (فرزند خشکبار)
    const pistachioCategory = await prisma.category.create({
        data: {
            bId: 3,
            sellUnits: [SellUnit.KILOGRAM, SellUnit.GRAM, SellUnit.TON, SellUnit.BOX, SellUnit.BAG],
            parent_id: driedFruitsCategory.id,
            contents: {
                create: [
                    {
                        language: Language.fa,
                        name: 'پسته',
                        description: 'انواع پسته فله، بسته بندی و صادراتی',
                        auto_translated: false
                    },
                    {
                        language: Language.en,
                        name: 'Pistachio',
                        description: 'Various types of bulk, packaged and export pistachios',
                        auto_translated: false
                    },
                    {
                        language: Language.ar,
                        name: 'الفستق',
                        description: 'أنواع مختلفة من الفستق السائب والمعبأ والصادر',
                        auto_translated: true
                    }
                ]
            }
        }
    });
    console.log(`✅ Category "پسته" seeded (ID: ${pistachioCategory.id})`);

    // ایجاد دسته‌بندی بادام (فرزند خشکبار)
    const almondCategory = await prisma.category.create({
        data: {
            bId: 4,
            sellUnits: [SellUnit.KILOGRAM, SellUnit.GRAM, SellUnit.BOX],
            parent_id: driedFruitsCategory.id,
            contents: {
                create: [
                    {
                        language: Language.fa,
                        name: 'بادام',
                        description: 'انواع بادام درختی، مغز بادام و بادام هندی',
                        auto_translated: false
                    },
                    {
                        language: Language.en,
                        name: 'Almond',
                        description: 'Various types of tree almonds, almond kernels and cashews',
                        auto_translated: false
                    },
                    {
                        language: Language.ar,
                        name: 'اللوز',
                        description: 'أنواع مختلفة من اللوز الشجري ونواة اللوز والكاجو',
                        auto_translated: true
                    }
                ]
            }
        }
    });
    console.log(`✅ Category "بادام" seeded (ID: ${almondCategory.id})`);

    // ایجاد دسته‌بندی گردو (فرزند خشکبار)
    const walnutCategory = await prisma.category.create({
        data: {
            bId: 5,
            sellUnits: [SellUnit.KILOGRAM, SellUnit.GRAM, SellUnit.BOX],
            parent_id: driedFruitsCategory.id,
            contents: {
                create: [
                    {
                        language: Language.fa,
                        name: 'گردو',
                        description: 'انواع گردو تازه، خشک و مغز گردو',
                        auto_translated: false
                    },
                    {
                        language: Language.en,
                        name: 'Walnut',
                        description: 'Various types of fresh, dried walnuts and walnut kernels',
                        auto_translated: false
                    },
                    {
                        language: Language.ar,
                        name: 'الجوز',
                        description: 'أنواع مختلفة من الجوز الطازج والمجفف ونواة الجوز',
                        auto_translated: true
                    }
                ]
            }
        }
    });
    console.log(`✅ Category "گردو" seeded (ID: ${walnutCategory.id})`);

    // ایجاد چند دسته‌بندی صنعتی برای تست بیشتر
    const industrialCategory = await prisma.category.create({
        data: {
            bId: 6,
            sellUnits: [SellUnit.TON, SellUnit.KILOGRAM, SellUnit.UNIT, SellUnit.PIECE],
            contents: {
                create: [
                    {
                        language: Language.fa,
                        name: 'محصولات صنعتی',
                        description: 'کلیه محصولات و مواد صنعتی',
                        auto_translated: false
                    },
                    {
                        language: Language.en,
                        name: 'Industrial Products',
                        description: 'All industrial products and materials',
                        auto_translated: false
                    }
                ]
            }
        }
    });
    console.log(`✅ Category "محصولات صنعتی" seeded (ID: ${industrialCategory.id})`);

    // ایجاد دسته‌بندی فلزات (فرزند صنعتی)
    const metalsCategory = await prisma.category.create({
        data: {
            bId: 7,
            sellUnits: [SellUnit.TON, SellUnit.KILOGRAM, SellUnit.ROLL, SellUnit.SHEET],
            parent_id: industrialCategory.id,
            contents: {
                create: [
                    {
                        language: Language.fa,
                        name: 'فلزات و آلیاژها',
                        description: 'انواع فلزات، آلیاژها و محصولات فلزی',
                        auto_translated: false
                    },
                    {
                        language: Language.en,
                        name: 'Metals & Alloys',
                        description: 'Various metals, alloys and metal products',
                        auto_translated: false
                    }
                ]
            }
        }
    });
    console.log(`✅ Category "فلزات و آلیاژها" seeded (ID: ${metalsCategory.id})`);

    // ایجاد دسته‌بندی پلاستیک (فرزند صنعتی)
    const plasticsCategory = await prisma.category.create({
        data: {
            bId: 8,
            sellUnits: [SellUnit.KILOGRAM, SellUnit.TON, SellUnit.ROLL, SellUnit.SHEET],
            parent_id: industrialCategory.id,
            contents: {
                create: [
                    {
                        language: Language.fa,
                        name: 'پلاستیک و پلیمر',
                        description: 'انواع مواد پلاستیکی، پلیمری و کامپوزیت',
                        auto_translated: false
                    },
                    {
                        language: Language.en,
                        name: 'Plastics & Polymers',
                        description: 'Various plastic materials, polymers and composites',
                        auto_translated: false
                    }
                ]
            }
        }
    });
    console.log(`✅ Category "پلاستیک و پلیمر" seeded (ID: ${plasticsCategory.id})`);

    console.log('🎉 All categories seeded successfully!');

    return {
        agricultureCategory,
        driedFruitsCategory,
        pistachioCategory,
        almondCategory,
        walnutCategory,
        industrialCategory,
        metalsCategory,
        plasticsCategory
    };
}

// برای اجرای مستقل
if (require.main === module) {
    categories_seed()
        .catch((error) => {
            console.error('❌ Error seeding categories:', error);
            process.exit(1);
        })
        .finally(() => {
            prisma.$disconnect();
            console.log('🔌 Database connection closed.');
        });
}

export { categories_seed };