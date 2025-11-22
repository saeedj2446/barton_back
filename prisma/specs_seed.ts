// prisma/seed-specs.ts
import { PrismaClient, Language } from '@prisma/client';

const prisma = new PrismaClient();

interface SpecData {
    key: string;
    type: string;
    data_type: string;
    is_required: boolean;
    is_filterable: boolean;
    is_searchable: boolean;
    sort_order: number;
    options?: string[];
    min_value?: number;
    max_value?: number;
    allowed_unit_keys?: string[]; // 🔥 اضافه شد
    contents: {
        language: Language;
        label: string;
        description: string;
    }[];
}

async function seedBaseSpecs() {
    console.log('🌱 Seeding specs for agriculture -> dried_fruits -> pistachio...');

    const allSpecs: SpecData[] = [
        // ویژگی‌های عمومی برای تمام محصولات کشاورزی
        {
            key: 'product_grade',
            type: 'SELECT',
            data_type: 'string',
            is_required: true,
            is_filterable: true,
            is_searchable: false,
            sort_order: 1,
            options: ['درجه یک', 'درجه دو', 'درجه سه', 'صنعتی'],
            contents: [
                {
                    language: Language.fa,
                    label: 'درجه محصول',
                    description: 'کیفیت و درجه محصول کشاورزی'
                }
            ]
        },
        {
            key: 'harvest_year',
            type: 'NUMBER',
            data_type: 'integer',
            is_required: true,
            is_filterable: true,
            is_searchable: false,
            sort_order: 2,
            min_value: 1400,
            max_value: 1403,
            contents: [
                {
                    language: Language.fa,
                    label: 'سال برداشت',
                    description: 'سال تولید محصول'
                }
            ]
        },
        {
            key: 'origin_province',
            type: 'SELECT',
            data_type: 'string',
            is_required: true,
            is_filterable: true,
            is_searchable: true,
            sort_order: 3,
            options: ['کرمان', 'خراسان', 'یزد', 'فارس', 'سمنان', 'قم'],
            contents: [
                {
                    language: Language.fa,
                    label: 'استان مبدا',
                    description: 'استان تولید محصول'
                }
            ]
        },

        // ویژگی‌های مخصوص خشکبار
        {
            key: 'packaging_type',
            type: 'SELECT',
            data_type: 'string',
            is_required: true,
            is_filterable: true,
            is_searchable: false,
            sort_order: 10,
            options: ['فله', 'بسته بندی', 'وکیوم', 'قوطی'],
            contents: [
                {
                    language: Language.fa,
                    label: 'نوع بسته بندی',
                    description: 'نوع بسته بندی محصول خشکبار'
                }
            ]
        },
        {
            key: 'shelf_life',
            type: 'NUMBER',
            data_type: 'integer',
            is_required: true,
            is_filterable: true,
            is_searchable: false,
            sort_order: 11,
            min_value: 1,
            max_value: 36,
            allowed_unit_keys: ['MONTH'], // 🔥 واحد زمان
            contents: [
                {
                    language: Language.fa,
                    label: 'مدت نگهداری',
                    description: 'مدت زمان قابل نگهداری محصول'
                }
            ]
        },
        {
            key: 'package_weight',
            type: 'NUMBER',
            data_type: 'float',
            is_required: false,
            is_filterable: true,
            is_searchable: false,
            sort_order: 12,
            min_value: 0.1,
            max_value: 1000,
            allowed_unit_keys: ['KILOGRAM', 'GRAM'], // 🔥 واحد وزن
            contents: [
                {
                    language: Language.fa,
                    label: 'وزن بسته',
                    description: 'وزن هر بسته محصول'
                }
            ]
        },

        // ویژگی‌های مخصوص پسته
        {
            key: 'pistachio_variety',
            type: 'SELECT',
            data_type: 'string',
            is_required: true,
            is_filterable: true,
            is_searchable: true,
            sort_order: 20,
            options: ['فندقی', 'کله قوچی', 'احمد آقایی', 'اکبری', 'بادامی'],
            contents: [
                {
                    language: Language.fa,
                    label: 'رقم پسته',
                    description: 'گونه و رقم پسته'
                }
            ]
        },
        {
            key: 'size_grade',
            type: 'SELECT',
            data_type: 'string',
            is_required: true,
            is_filterable: true,
            is_searchable: false,
            sort_order: 21,
            options: ['سوپر درشت', 'درشت', 'متوسط', 'ریز'],
            contents: [
                {
                    language: Language.fa,
                    label: 'سایز دانه',
                    description: 'اندازه دانه پسته'
                }
            ]
        },
        {
            key: 'split_ratio',
            type: 'NUMBER',
            data_type: 'float',
            is_required: true,
            is_filterable: true,
            is_searchable: false,
            sort_order: 22,
            min_value: 0,
            max_value: 100,
            allowed_unit_keys: ['PERCENT'], // 🔥 واحد درصد
            contents: [
                {
                    language: Language.fa,
                    label: 'درصد دهان بست',
                    description: 'میزان دهان بستی پسته'
                }
            ]
        },
        {
            key: 'moisture_content',
            type: 'NUMBER',
            data_type: 'float',
            is_required: true,
            is_filterable: true,
            is_searchable: false,
            sort_order: 23,
            min_value: 0,
            max_value: 20,
            allowed_unit_keys: ['PERCENT'], // 🔥 واحد درصد
            contents: [
                {
                    language: Language.fa,
                    label: 'رطوبت',
                    description: 'میزان رطوبت پسته'
                }
            ]
        },
        {
            key: 'color',
            type: 'SELECT',
            data_type: 'string',
            is_required: false,
            is_filterable: true,
            is_searchable: false,
            sort_order: 24,
            options: ['سبز', 'زرد', 'قهوه ای', 'مخلوط'],
            contents: [
                {
                    language: Language.fa,
                    label: 'رنگ',
                    description: 'رنگ پسته'
                }
            ]
        },
        {
            key: 'kernel_weight',
            type: 'NUMBER',
            data_type: 'float',
            is_required: false,
            is_filterable: true,
            is_searchable: false,
            sort_order: 25,
            min_value: 0.5,
            max_value: 2.5,
            allowed_unit_keys: ['GRAM'], // 🔥 واحد وزن
            contents: [
                {
                    language: Language.fa,
                    label: 'وزن مغز',
                    description: 'میانگین وزن مغز هر دانه پسته'
                }
            ]
        },
        {
            key: 'protein_content',
            type: 'NUMBER',
            data_type: 'float',
            is_required: false,
            is_filterable: true,
            is_searchable: false,
            sort_order: 26,
            min_value: 10,
            max_value: 30,
            allowed_unit_keys: ['PERCENT'], // 🔥 واحد درصد
            contents: [
                {
                    language: Language.fa,
                    label: 'پروتئین',
                    description: 'میزان پروتئین موجود در پسته'
                }
            ]
        },
        {
            key: 'fat_content',
            type: 'NUMBER',
            data_type: 'float',
            is_required: false,
            is_filterable: true,
            is_searchable: false,
            sort_order: 27,
            min_value: 40,
            max_value: 60,
            allowed_unit_keys: ['PERCENT'], // 🔥 واحد درصد
            contents: [
                {
                    language: Language.fa,
                    label: 'چربی',
                    description: 'میزان چربی موجود در پسته'
                }
            ]
        },
        {
            key: 'package_dimensions',
            type: 'NUMBER',
            data_type: 'float',
            is_required: false,
            is_filterable: false,
            is_searchable: false,
            sort_order: 28,
            min_value: 1,
            max_value: 200,
            allowed_unit_keys: ['CENTIMETER'], // 🔥 واحد طول
            contents: [
                {
                    language: Language.fa,
                    label: 'ابعاد بسته',
                    description: 'ابعاد بسته بندی محصول'
                }
            ]
        }
    ];

    for (const specData of allSpecs) {
        try {
            // ساخت داده‌های اصلی
            const createData: any = {
                key: specData.key,
                type: specData.type,
                data_type: specData.data_type,
                is_required: specData.is_required,
                is_filterable: specData.is_filterable,
                is_searchable: specData.is_searchable,
                sort_order: specData.sort_order,
                options: specData.options || [],
                allowed_unit_keys: specData.allowed_unit_keys || [] // 🔥 اضافه شد
            };

            // اضافه کردن فیلدهای اختیاری
            if (specData.min_value !== undefined) {
                createData.min_value = specData.min_value;
            }
            if (specData.max_value !== undefined) {
                createData.max_value = specData.max_value;
            }

            // استفاده از upsert
            const spec = await prisma.spec.upsert({
                where: { key: specData.key },
                update: createData,
                create: {
                    ...createData,
                    contents: {
                        create: specData.contents.map(content => ({
                            language: content.language,
                            label: content.label,
                            description: content.description,
                            auto_translated: false
                        }))
                    }
                }
            });

            console.log(`✅ Spec "${specData.key}" upserted`);
        } catch (error) {
            console.error(`❌ Error with spec "${specData.key}":`, error);
        }
    }

    console.log(`🎉 Successfully processed ${allSpecs.length} specs`);
    console.log('📊 Units used: PERCENT, KILOGRAM, GRAM, MONTH, CENTIMETER');
}

seedBaseSpecs()
    .catch(console.error)
    .finally(() => prisma.$disconnect());