// prisma/seed-industries.ts
import { PrismaClient, Language, IndustryBusinessType } from '@prisma/client';
import { Industries } from './data-industries';

const prisma = new PrismaClient();

// تایپ برای داده‌های صنف
interface RawIndustry {
    business_number: string;
    TXT_TITLE_BUSINESS: string;
    DRP_BUSINESS_TAGS_LABEL: string;
    DRP_CUSTODIAN_ISSUE_AUTHORITY_LABEL: string;
    DRP_DEPARTMENT: string;
    DRP_DEPARTMENT_LABEL: string;
    DRP_BRANCH: string;
    DRP_BRANCH_LABEL: string;
    DRP_SUB_BRANCH: string;
    DRP_SUB_BRANCH_LABEL: string;
    DRP_BUSINESS_TREE: string;
    TXR_BUSINESS_INTRODUCTION: string;
    CATEGORY_ID?: string;
    BUTTONS: any[];
    PRIORITY1: string;
    PRIORITY2: string;
    PRIORITY3: string;
}

// کلمات بی‌خاصیت برای فیلتر کردن
const uselessWords = [
    'اتحادیه', 'اصناف', 'پروانه صنفی', 'پروانه', 'صنفی',
    'پروانه کسب صنفی', 'پروانه', 'کسب', 'صنفی', 'عرضه',
    'خدمات', 'احداث', 'بهره', 'برداری', 'وزارت', 'شرکت',
    'ملی', 'فرآورده', 'های', 'مواد', 'غذایی'
];

// مپینگ نوع کسب‌وکار از CATEGORY_ID
function mapBusinessType(categoryId?: string): IndustryBusinessType[] {
    if (!categoryId) return ['SERVICE'];

    const map: { [key: string]: IndustryBusinessType[] } = {
        '1': ['HOUSEHOLD'],      // خانگی
        '2': ['GUILD'],          // صنفی
        '3': ['SERVICE']         // خدماتی
    };

    return map[categoryId] || ['SERVICE'];
}

// فیلتر کردن تگ‌های بی‌خاصیت
function filterUsefulTags(tags: string[]): string[] {
    return tags.filter(tag => {
        // حذف کلمات بی‌خاصیت
        if (uselessWords.some(useless => tag.includes(useless))) {
            return false;
        }
        // حذف تگ‌های خیلی کوتاه یا خیلی طولانی
        if (tag.length < 2 || tag.length > 20) {
            return false;
        }
        // حذف اعداد خالص
        if (/^\d+$/.test(tag)) {
            return false;
        }
        return true;
    });
}

// استخراج محصولات خرید و فروش
function extractProducts(tags: string[], introduction: string, businessName: string, businessType: IndustryBusinessType[]) {
    const allText = [...tags, introduction || '', businessName].join(' ').toLowerCase();

    // محصولات بر اساس نوع صنف و تگ‌ها
    const industryProducts: { [key: string]: { buy: string[], sell: string[] } } = {
        'غذایی': {
            buy: ['مواد اولیه', 'ادویه', 'روغن', 'شکر', 'نمک', 'بسته‌بندی'],
            sell: ['غذا', 'نوشیدنی', 'شیرینی', 'خشکبار', 'کنسرو']
        },
        'پوشاک': {
            buy: ['پارچه', 'نخ', 'دکمه', 'زیپ', 'لوازم خیاطی'],
            sell: ['لباس', 'کفش', 'کیف', 'اکسسوری', 'پوشاک']
        },
        'ساختمانی': {
            buy: ['سیمان', 'آجر', 'سنگ', 'سرامیک', 'لوله', 'شیرآلات'],
            sell: ['مصالح', 'تجهیزات', 'ابزار', 'کاشی', 'چوب']
        },
        'خودرو': {
            buy: ['قطعات', 'لاستیک', 'باتری', 'روغن', 'فیلتر'],
            sell: ['خودرو', 'موتور', 'لوازم یدکی', 'لوازم جانبی']
        },
        'کشاورزی': {
            buy: ['بذر', 'کود', 'سم', 'تجهیزات آبیاری', 'خوراک دام'],
            sell: ['محصولات کشاورزی', 'میوه', 'سبزی', 'گوشت', 'مرغ']
        },
        'الکترونیک': {
            buy: ['قطعات الکترونیکی', 'برد', 'سیم', 'باتری', 'شارژر'],
            sell: ['موبایل', 'لپ تاپ', 'تلویزیون', 'دوربین', 'هدفون']
        },
        'پزشکی': {
            buy: ['دارو', 'تجهیزات پزشکی', 'ماسک', 'دستکش', 'سرنگ'],
            sell: ['خدمات درمانی', 'معاینه', 'دارو', 'مکمل']
        },
        'خدماتی': {
            buy: ['تجهیزات اداری', 'کاغذ', 'جوهر', 'لوازم تحریر'],
            sell: ['خدمات مشاوره', 'طراحی', 'برنامه‌نویسی', 'پشتیبانی']
        }
    };

    // تشخیص نوع صنف
    let industryCategory = 'خدماتی';
    if (allText.includes('غذا') || allText.includes('خوراک')) industryCategory = 'غذایی';
    else if (allText.includes('پوشاک') || allText.includes('لباس')) industryCategory = 'پوشاک';
    else if (allText.includes('ساختمان') || allText.includes('سیمان')) industryCategory = 'ساختمانی';
    else if (allText.includes('خودرو') || allText.includes('ماشین')) industryCategory = 'خودرو';
    else if (allText.includes('کشاورز') || allText.includes('دام')) industryCategory = 'کشاورزی';
    else if (allText.includes('الکترونیک') || allText.includes('کامپیوتر')) industryCategory = 'الکترونیک';
    else if (allText.includes('پزشک') || allText.includes('درمان')) industryCategory = 'پزشکی';

    const products = industryProducts[industryCategory] || industryProducts['خدماتی'];

    // اضافه کردن محصولات از تگ‌های مفید
    const usefulTags = filterUsefulTags(tags);
    const tagProducts = usefulTags.slice(0, 5);

    return {
        buy: [...products.buy, ...tagProducts.slice(0, 3)],
        sell: [...products.sell, ...tagProducts.slice(3, 6)]
    };
}

// استخراج تگ‌های مرتبط
function extractRelatedTags(tags: string[], businessName: string): string[] {
    const relatedTags = new Set<string>();

    // فقط تگ‌های مفید اضافه کن
    const usefulTags = filterUsefulTags(tags);
    usefulTags.forEach(tag => {
        relatedTags.add(tag);
    });

    // اضافه کردن کلمات مفید از نام کسب‌وکار
    if (businessName) {
        businessName.split(' ').forEach(word => {
            if (word && word.length > 2 && word.length < 20) {
                // حذف کلمات بی‌خاصیت از نام کسب‌وکار
                if (!uselessWords.some(useless => word.includes(useless))) {
                    relatedTags.add(word);
                }
            }
        });
    }

    return Array.from(relatedTags).slice(0, 10);
}

// تابع برای تولید کد پیش‌فرض
function generateDefaultCode(level: number, index: number): string {
    const prefixes = ['D', 'B', 'S', 'I'];
    return `${prefixes[level - 1]}${index.toString().padStart(3, '0')}`;
}

// تابع برای ایجاد شاخه با کنترل تکراری
async function createBranchIfNotExists(branchData: any, contentData: any[]) {
    try {
        // اول بررسی کن آیا شاخه با این کد وجود دارد
        const existingBranch = await prisma.industryBranch.findFirst({
            where: {
                code: branchData.code
            }
        });

        if (existingBranch) {
            console.log(`⚠️ شاخه تکراری نادیده گرفته شد: ${contentData[0]?.name || branchData.code} (${branchData.code})`);
            return existingBranch.id;
        }

        // اگر وجود نداشت، ایجاد کن
        const branch = await prisma.industryBranch.create({
            data: {
                ...branchData,
                contents: {
                    create: contentData
                }
            }
        });

        console.log(`✅ شاخه ایجاد شد: ${contentData[0]?.name || branchData.code} (${branchData.code})`);
        return branch.id;
    } catch (error: any) {
        // اگر خطای تکراری بود، نادیده بگیر
        if (error.code === 'P2002') {
            console.log(`⚠️ شاخه تکراری (خطای دیتابیس): ${contentData[0]?.name || branchData.code} (${branchData.code})`);

            // شاخه موجود رو پیدا کن و برگردون
            const existing = await prisma.industryBranch.findFirst({
                where: {
                    code: branchData.code
                }
            });
            return existing?.id;
        }
        throw error;
    }
}

// تابع برای ایجاد صنف با کنترل تکراری
async function createIndustryIfNotExists(industryData: any, contentData: any[]) {
    try {
        // بررسی تکراری بودن بر اساس business_number
        const existingIndustry = await prisma.industry.findFirst({
            where: {
                business_number: industryData.business_number
            }
        });

        if (existingIndustry) {
            return { success: false, reason: 'duplicate', data: existingIndustry };
        }

        const industry = await prisma.industry.create({
            data: {
                ...industryData,
                contents: {
                    create: contentData
                }
            }
        });

        return { success: true, data: industry };
    } catch (error: any) {
        // اگر خطای تکراری بود، نادیده بگیر
        if (error.code === 'P2002') {
            console.log(`⚠️ صنف تکراری: ${contentData[0]?.name || industryData.business_number}`);
            return { success: false, reason: 'database_duplicate', data: null };
        }
        throw error;
    }
}

async function seedIndustries() {
    console.log('🌱 شروع سید صنف‌ها...');
    console.log(`📊 تعداد صنف‌های موجود: ${Industries.length}`);

    try {
        // پاکسازی داده‌های قبلی - با ترتیب درست
        console.log('🧹 در حال پاکسازی داده‌های قبلی...');

        // اول محتواها رو پاک کن
        await prisma.industryContent.deleteMany();
        await prisma.industryBranchContent.deleteMany();

        // سپس مدل‌های اصلی
        await prisma.industryRelation.deleteMany();
        await prisma.industry.deleteMany();

        // برای پاک کردن IndustryBranch باید اول parentIdها رو null کنیم
        await prisma.industryBranch.updateMany({
            data: { parentId: null }
        });
        await prisma.industryBranch.deleteMany();

        console.log('✅ داده‌های قبلی پاک شد');

        // استخراج ساختار درختی منحصر به فرد
        const uniqueStructures = new Map();

        Industries.forEach(industry => {
            const key = `${industry.DRP_DEPARTMENT}-${industry.DRP_BRANCH}-${industry.DRP_SUB_BRANCH}`;
            if (!uniqueStructures.has(key)) {
                uniqueStructures.set(key, {
                    department: industry.DRP_DEPARTMENT,
                    department_label: industry.DRP_DEPARTMENT_LABEL,
                    branch: industry.DRP_BRANCH,
                    branch_label: industry.DRP_BRANCH_LABEL,
                    sub_branch: industry.DRP_SUB_BRANCH,
                    sub_branch_label: industry.DRP_SUB_BRANCH_LABEL,
                    business_tree: industry.DRP_BUSINESS_TREE
                });
            }
        });

        console.log(`🏗️ ساختار درختی: ${uniqueStructures.size} شاخه منحصر به فرد`);

        // ایجاد ساختار درختی
        const branchMap = new Map();

        // ایجاد departmentها (سطح 1)
        const uniqueDepartments = new Map();
        Array.from(uniqueStructures.values()).forEach(structure => {
            const deptKey = structure.department;
            if (!uniqueDepartments.has(deptKey)) {
                uniqueDepartments.set(deptKey, {
                    code: structure.department || generateDefaultCode(1, uniqueDepartments.size + 1),
                    name: structure.department_label,
                    level: 1
                });
            }
        });

        // ایجاد branchها (سطح 2)
        const uniqueBranches = new Map();
        Array.from(uniqueStructures.values()).forEach(structure => {
            const branchKey = `${structure.department}-${structure.branch}`;
            if (!uniqueBranches.has(branchKey)) {
                uniqueBranches.set(branchKey, {
                    code: structure.branch || generateDefaultCode(2, uniqueBranches.size + 1),
                    name: structure.branch_label,
                    department_code: structure.department,
                    level: 2
                });
            }
        });

        // ایجاد sub_branchها (سطح 3)
        const uniqueSubBranches = new Map();
        Array.from(uniqueStructures.values()).forEach(structure => {
            const subBranchKey = `${structure.department}-${structure.branch}-${structure.sub_branch}`;
            if (!uniqueSubBranches.has(subBranchKey)) {
                uniqueSubBranches.set(subBranchKey, {
                    code: structure.sub_branch || generateDefaultCode(3, uniqueSubBranches.size + 1),
                    name: structure.sub_branch_label,
                    branch_code: structure.branch,
                    department_code: structure.department,
                    business_tree_code: structure.business_tree,
                    level: 3
                });
            }
        });

        console.log(`📊 سطوح درختی:`);
        console.log(`   سطح 1 (Department): ${uniqueDepartments.size} مورد`);
        console.log(`   سطح 2 (Branch): ${uniqueBranches.size} مورد`);
        console.log(`   سطح 3 (Sub Branch): ${uniqueSubBranches.size} مورد`);

        // ایجاد شاخه‌ها در دیتابیس با کنترل تکراری
        const departmentBranches = new Map();

        // ایجاد Departmentها
        let deptIndex = 0;
        for (const [key, dept] of uniqueDepartments) {
            deptIndex++;
            const branchId = await createBranchIfNotExists(
                {
                    code: dept.code,
                    level: dept.level,
                    department_code: '16000000'
                },
                [
                    {
                        language: Language.fa,
                        name: dept.name || `Department ${deptIndex}`,
                        department: 'وزارت امور اقتصادی و دارایی',
                        auto_translated: false
                    }
                ]
            );
            departmentBranches.set(key, branchId);
        }

        // ایجاد Branchها
        const branchBranches = new Map();
        let branchIndex = 0;
        for (const [key, branchData] of uniqueBranches) {
            branchIndex++;
            const parentId = departmentBranches.get(branchData.department_code);
            if (parentId) {
                const branchId = await createBranchIfNotExists(
                    {
                        code: branchData.code,
                        level: branchData.level,
                        parentId: parentId,
                        department_code: '16000000'
                    },
                    [
                        {
                            language: Language.fa,
                            name: branchData.name || `Branch ${branchIndex}`,
                            department: 'وزارت امور اقتصادی و دارایی',
                            auto_translated: false
                        }
                    ]
                );
                branchBranches.set(key, branchId);
            }
        }

        // ایجاد Sub Branchها
        const subBranchBranches = new Map();
        let subBranchIndex = 0;
        for (const [key, subBranchData] of uniqueSubBranches) {
            subBranchIndex++;
            const branchKey = `${subBranchData.department_code}-${subBranchData.branch_code}`;
            const parentId = branchBranches.get(branchKey);
            if (parentId) {
                const branchId = await createBranchIfNotExists(
                    {
                        code: subBranchData.code,
                        level: subBranchData.level,
                        parentId: parentId,
                        department_code: '16000000',
                        business_tree_code: subBranchData.business_tree_code
                    },
                    [
                        {
                            language: Language.fa,
                            name: subBranchData.name || `Sub Branch ${subBranchIndex}`,
                            department: 'وزارت امور اقتصادی و دارایی',
                            auto_translated: false
                        }
                    ]
                );
                subBranchBranches.set(key, branchId);
            }
        }

        console.log(`✅ ساختار درختی ایجاد شد: ${subBranchBranches.size} شاخه نهایی`);

        // ایجاد صنف‌ها با کنترل تکراری
        const industriesToSeed = Industries;
        let successCount = 0;
        let duplicateCount = 0;
        let errorCount = 0;

        console.log(`🔧 در حال ایجاد ${industriesToSeed.length} صنف...`);

        for (const industryData of industriesToSeed) {
            try {
                const rawTags = (industryData.DRP_BUSINESS_TAGS_LABEL || '')
                    .split(',')
                    .map(tag => tag.trim())
                    .filter(tag => tag);

                // فیلتر کردن تگ‌های مفید
                const usefulTags = filterUsefulTags(rawTags);

                const businessType = mapBusinessType(industryData.CATEGORY_ID);
                const products = extractProducts(
                    usefulTags,
                    industryData.TXR_BUSINESS_INTRODUCTION || '',
                    industryData.TXT_TITLE_BUSINESS || 'صنف ناشناس',
                    businessType
                );

                // پیدا کردن شاخه مرتبط
                const branchKey = `${industryData.DRP_DEPARTMENT}-${industryData.DRP_BRANCH}-${industryData.DRP_SUB_BRANCH}`;
                const industryBranchId = subBranchBranches.get(branchKey);

                if (!industryBranchId) {
                    errorCount++;
                    console.log(`❌ شاخه مرتبط پیدا نشد برای: ${industryData.TXT_TITLE_BUSINESS}`);
                    continue;
                }

                // آماده کردن داده‌های محتوای چندزبانه
                const industryContents = [
                    {
                        language: Language.fa,
                        name: industryData.TXT_TITLE_BUSINESS || 'صنف ناشناس',
                        description: (industryData.TXT_TITLE_BUSINESS || 'صنف ناشناس').substring(0, 100),
                        introduction: (industryData.TXR_BUSINESS_INTRODUCTION || industryData.TXT_TITLE_BUSINESS || 'بدون معرفی').substring(0, 500),
                        business_tags: usefulTags.slice(0, 15), // انتقال به IndustryContent
                        related_tags: extractRelatedTags(usefulTags, industryData.TXT_TITLE_BUSINESS || ''), // انتقال به IndustryContent
                        auto_translated: false
                    }
                ];

                const result = await createIndustryIfNotExists(
                    {
                        business_number: industryData.business_number || 'بدون شماره',
                        industry_branch_id: industryBranchId,
                        business_type: businessType,
                        is_active: true,
                        buy_products: products.buy,
                        sell_products: products.sell,
                        level: 4, // صنف‌ها سطح 4 هستند
                        priority1: parseInt(industryData.PRIORITY1) || 0,
                        priority2: parseInt(industryData.PRIORITY2) || 0,
                        priority3: parseInt(industryData.PRIORITY3) || 0
                    },
                    industryContents
                );

                if (result.success) {
                    successCount++;
                } else {
                    duplicateCount++;
                }

                if ((successCount + duplicateCount) % 100 === 0) {
                    console.log(`📊 ${successCount} صنف ایجاد شد, ${duplicateCount} تکراری نادیده گرفته شد...`);
                }
            } catch (error) {
                errorCount++;
                console.error(`❌ خطا در ایجاد صنف ${industryData.TXT_TITLE_BUSINESS}:`, error);
            }
        }

        console.log(`\n🎉 ایجاد صنف‌ها کامل شد!`);
        console.log(`✅ صنف‌های موفق: ${successCount}`);
        console.log(`⚠️ صنف‌های تکراری: ${duplicateCount}`);
        console.log(`❌ صنف‌های ناموفق: ${errorCount}`);

        // ایجاد روابط صنفی با کنترل تکراری
        console.log('🔗 در حال ایجاد روابط صنفی...');

        // گرفتن تمام صنف‌ها با محتوایشان
        const allIndustries = await prisma.industry.findMany({
            include: {
                contents: {
                    where: { language: Language.fa }
                }
            }
        });

        let relationCount = 0;
        let duplicateRelationCount = 0;

        // ایجاد روابط بین صنف‌های مرتبط
        for (let i = 0; i < Math.min(200, allIndustries.length); i++) {
            for (let j = i + 1; j < Math.min(i + 20, allIndustries.length); j++) {
                // دسترسی به business_tags از طریق contents
                const industryITags = allIndustries[i].contents[0]?.business_tags || [];
                const industryJTags = allIndustries[j].contents[0]?.business_tags || [];

                const commonTags = industryITags.filter(tag =>
                    industryJTags.includes(tag)
                );

                if (commonTags.length > 1) {
                    try {
                        await prisma.industryRelation.create({
                            data: {
                                supplier_industry_id: allIndustries[i].id,
                                customer_industry_id: allIndustries[j].id,
                                relation_type: 'DIRECT_SUPPLY',
                                strength: Math.min(commonTags.length / 10, 1.0)
                            }
                        });
                        relationCount++;
                    } catch (error: any) {
                        if (error.code === 'P2002') {
                            duplicateRelationCount++;
                        }
                    }
                }
            }
        }

        console.log(`✅ ${relationCount} رابطه صنفی ایجاد شد`);
        console.log(`⚠️ ${duplicateRelationCount} رابطه تکراری نادیده گرفته شد`);

        // نمایش خلاصه
        console.log('\n📊 خلاصه نهایی:');
        console.log(`🏗️ ساختار درختی: ${subBranchBranches.size} شاخه`);
        console.log(`🏭 صنف‌ها: ${successCount} مورد (${duplicateCount} تکراری)`);
        console.log(`🔗 روابط: ${relationCount} مورد (${duplicateRelationCount} تکراری)`);

    } catch (error) {
        console.error('❌ خطا در سید:', error);
    }
}

// اجرا
seedIndustries()
    .catch(console.error)
    .finally(() => prisma.$disconnect());