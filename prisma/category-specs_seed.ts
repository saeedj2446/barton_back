// prisma/seed-category-specs.ts
import { PrismaClient, Language } from '@prisma/client';

const prisma = new PrismaClient();

async function seedCategorySpecs() {
    console.log('🌱 Seeding category-spec relationships...');

    // گرفتن Categoryها با محتوای فارسی
    const categories = await prisma.category.findMany({
        include: {
            contents: {
                where: { language: Language.fa },
                select: { name: true }
            }
        }
    });

    const specs = await prisma.spec.findMany({
        select: { id: true, key: true }
    });

    console.log(`📊 Found ${categories.length} categories and ${specs.length} specs`);

    // پیدا کردن Categoryها بر اساس bId
    const agriculture = categories.find(c => c.bId === 1);
    const driedFruits = categories.find(c => c.bId === 2);
    const pistachio = categories.find(c => c.bId === 3);
    const almond = categories.find(c => c.bId === 4);
    const walnut = categories.find(c => c.bId === 5);
    const industrial = categories.find(c => c.bId === 6);
    const metals = categories.find(c => c.bId === 7);
    const plastics = categories.find(c => c.bId === 8);

    // پیدا کردن Specها
    const productGrade = specs.find(s => s.key === 'product_grade');
    const harvestYear = specs.find(s => s.key === 'harvest_year');
    const originProvince = specs.find(s => s.key === 'origin_province');
    const shelfLife = specs.find(s => s.key === 'shelf_life');
    const packageWeight = specs.find(s => s.key === 'package_weight');
    const pistachioVariety = specs.find(s => s.key === 'pistachio_variety');
    const sizeGrade = specs.find(s => s.key === 'size_grade');
    const splitRatio = specs.find(s => s.key === 'split_ratio');
    const moistureContent = specs.find(s => s.key === 'moisture_content');
    const kernelWeight = specs.find(s => s.key === 'kernel_weight');
    const almondVariety = specs.find(s => s.key === 'almond_variety');
    const walnutVariety = specs.find(s => s.key === 'walnut_variety');
    const materialType = specs.find(s => s.key === 'material_type');
    const thickness = specs.find(s => s.key === 'thickness');
    const alloyGrade = specs.find(s => s.key === 'alloy_grade');
    const polymerType = specs.find(s => s.key === 'polymer_type');
    const meltingPoint = specs.find(s => s.key === 'melting_point');

    // تعریف ارتباطات
    const relationships: Array<{category: any, spec: any}> = [];

    // محصولات کشاورزی - ویژگی‌های عمومی
    if (agriculture && productGrade) relationships.push({category: agriculture, spec: productGrade});
    if (agriculture && harvestYear) relationships.push({category: agriculture, spec: harvestYear});
    if (agriculture && originProvince) relationships.push({category: agriculture, spec: originProvince});

    // خشکبار - ویژگی‌های عمومی خشکبار
    if (driedFruits && shelfLife) relationships.push({category: driedFruits, spec: shelfLife});
    if (driedFruits && packageWeight) relationships.push({category: driedFruits, spec: packageWeight});
    if (driedFruits && productGrade) relationships.push({category: driedFruits, spec: productGrade});

    // پسته - ویژگی‌های مخصوص
    if (pistachio && pistachioVariety) relationships.push({category: pistachio, spec: pistachioVariety});
    if (pistachio && sizeGrade) relationships.push({category: pistachio, spec: sizeGrade});
    if (pistachio && splitRatio) relationships.push({category: pistachio, spec: splitRatio});
    if (pistachio && moistureContent) relationships.push({category: pistachio, spec: moistureContent});
    if (pistachio && kernelWeight) relationships.push({category: pistachio, spec: kernelWeight});
    if (pistachio && productGrade) relationships.push({category: pistachio, spec: productGrade});

    // بادام - ویژگی‌های مخصوص
    if (almond && almondVariety) relationships.push({category: almond, spec: almondVariety});
    if (almond && sizeGrade) relationships.push({category: almond, spec: sizeGrade});
    if (almond && kernelWeight) relationships.push({category: almond, spec: kernelWeight});
    if (almond && productGrade) relationships.push({category: almond, spec: productGrade});

    // گردو - ویژگی‌های مخصوص
    if (walnut && walnutVariety) relationships.push({category: walnut, spec: walnutVariety});
    if (walnut && sizeGrade) relationships.push({category: walnut, spec: sizeGrade});
    if (walnut && kernelWeight) relationships.push({category: walnut, spec: kernelWeight});
    if (walnut && productGrade) relationships.push({category: walnut, spec: productGrade});

    // محصولات صنعتی - ویژگی‌های عمومی
    if (industrial && materialType) relationships.push({category: industrial, spec: materialType});
    if (industrial && thickness) relationships.push({category: industrial, spec: thickness});

    // فلزات - ویژگی‌های مخصوص
    if (metals && alloyGrade) relationships.push({category: metals, spec: alloyGrade});
    if (metals && thickness) relationships.push({category: metals, spec: thickness});
    if (metals && materialType) relationships.push({category: metals, spec: materialType});

    // پلاستیک - ویژگی‌های مخصوص
    if (plastics && polymerType) relationships.push({category: plastics, spec: polymerType});
    if (plastics && meltingPoint) relationships.push({category: plastics, spec: meltingPoint});
    if (plastics && materialType) relationships.push({category: plastics, spec: materialType});

    // ایجاد ارتباطات
    let createdCount = 0;
    let skippedCount = 0;

    for (const {category, spec} of relationships) {
        try {
            await prisma.categorySpec.upsert({
                where: {
                    category_id_spec_id: {
                        category_id: category.id,
                        spec_id: spec.id
                    }
                },
                update: {},
                create: {
                    category_id: category.id,
                    spec_id: spec.id
                }
            });
            const categoryName = category.contents[0]?.name || `Category ${category.bId}`;
            console.log(`✅ Linked: ${categoryName} ← ${spec.key}`);
            createdCount++;
        } catch (error: any) {
            if (error.code === 'P2002') {
                // رابطه تکراری - نادیده بگیر
                skippedCount++;
            } else {
                const categoryName = category.contents[0]?.name || `Category ${category.bId}`;
                console.error(`❌ Error linking ${categoryName} - ${spec.key}:`, error.message);
            }
        }
    }

    console.log(`🎉 Created ${createdCount} category-spec relationships (${skippedCount} duplicates skipped)`);

    // نمایش خلاصه
    console.log('\n📋 Relationship Summary:');
    const categoryGroups: Record<string, string[]> = {};

    relationships.forEach(({category, spec}) => {
        const categoryName = category.contents[0]?.name || `Category ${category.bId}`;
        if (!categoryGroups[categoryName]) {
            categoryGroups[categoryName] = [];
        }
        categoryGroups[categoryName].push(spec.key);
    });

    Object.entries(categoryGroups).forEach(([categoryName, specKeys]) => {
        console.log(`   ${categoryName}: ${specKeys.join(', ')}`);
    });
}

// برای اجرای مستقل
if (require.main === module) {
    seedCategorySpecs()
        .catch((error) => {
            console.error('❌ Error seeding category-spec relationships:', error);
            process.exit(1);
        })
        .finally(() => {
            prisma.$disconnect();
            console.log('🔌 Database connection closed.');
        });
}

export { seedCategorySpecs };