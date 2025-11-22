// prisma/seed-plans.ts
import { PrismaClient, PlanStatus, Language } from '@prisma/client';

const prisma = new PrismaClient();

async function seedPlans() {
    console.log('🌱 Seeding plans with multilingual content...');

    // پاک کردن داده‌های قبلی
    await prisma.planContent.deleteMany({});
    await prisma.plan.deleteMany({});

    const plans = [
        {
            level: 1,
            price: 0,
            credit_amount: 0,
            bonus_credit: 200000,
            total_credit: 200000,
            expiry_days: 60,
            status: PlanStatus.ACTIVE,
            is_popular: false,
            contents: [
                {
                    language: Language.fa,
                    name: "بسته رایگان",
                    description: "ویژه تازه‌واردان - ۲۰۰,۰۰۰ تومان اعتبار رایگان",
                    benefits: ["اعتبار رایگان برای تست پلتفرم", "دسترسی به امکانات پایه"],
                    auto_translated: false
                },
                {
                    language: Language.en,
                    name: "Free Package",
                    description: "For newcomers - 200,000 Toman free credit",
                    benefits: ["Free credit to test the platform", "Access to basic features"],
                    auto_translated: false
                },
                {
                    language: Language.ar,
                    name: "الباقة المجانية",
                    description: "للوافدين الجدد - 200,000 تومان رصيد مجاني",
                    benefits: ["رصيد مجاني لاختبار المنصة", "الوصول إلى الميزات الأساسية"],
                    auto_translated: true
                }
            ]
        },
        {
            level: 2,
            price: 100000,
            credit_amount: 100000,
            bonus_credit: 0,
            total_credit: 100000,
            expiry_days: 90,
            status: PlanStatus.ACTIVE,
            is_popular: true,
            contents: [
                {
                    language: Language.fa,
                    name: "بسته شارژ صد هزار تومانی",
                    description: "شارژ پایه - بدون پاداش",
                    benefits: ["مناسب برای شروع فعالیت", "مدت اعتبار ۹۰ روزه"],
                    auto_translated: false
                },
                {
                    language: Language.en,
                    name: "100K Toman Package",
                    description: "Basic charge - no bonus",
                    benefits: ["Suitable for starting activity", "90 days validity"],
                    auto_translated: false
                },
                {
                    language: Language.ar,
                    name: "باقة 100 ألف تومان",
                    description: "شحن أساسي - بدون مكافأة",
                    benefits: ["مناسب لبدء النشاط", "صلاحية 90 يومًا"],
                    auto_translated: true
                }
            ]
        },
        {
            level: 3,
            price: 1000000,
            credit_amount: 1000000,
            bonus_credit: 300000,
            total_credit: 1300000,
            expiry_days: 180,
            status: PlanStatus.ACTIVE,
            is_popular: false,
            contents: [
                {
                    language: Language.fa,
                    name: "بسته شارژ یک میلیون تومانی",
                    description: "۳۰٪ شارژ اضافه دریافت کنید",
                    benefits: ["۳۰۰,۰۰۰ تومان اعتبار هدیه", "مدت اعتبار ۱۸۰ روزه"],
                    auto_translated: false
                },
                {
                    language: Language.en,
                    name: "1 Million Toman Package",
                    description: "Get 30% extra charge",
                    benefits: ["300,000 Toman bonus credit", "180 days validity"],
                    auto_translated: false
                },
                {
                    language: Language.ar,
                    name: "باقة مليون تومان",
                    description: "احصل على 30٪ شحن إضافي",
                    benefits: ["300,000 تومان رصيد مكافأة", "صلاحية 180 يومًا"],
                    auto_translated: true
                }
            ]
        },
        {
            level: 4,
            price: 2000000,
            credit_amount: 2000000,
            bonus_credit: 800000,
            total_credit: 2800000,
            expiry_days: 365,
            status: PlanStatus.ACTIVE,
            is_popular: false,
            contents: [
                {
                    language: Language.fa,
                    name: "بسته شارژ دو میلیون تومانی",
                    description: "۴۰٪ شارژ اضافه دریافت کنید",
                    benefits: ["۸۰۰,۰۰۰ تومان اعتبار هدیه", "پشتیبانی تلفنی", "مدت اعتبار یکساله"],
                    auto_translated: false
                },
                {
                    language: Language.en,
                    name: "2 Million Toman Package",
                    description: "Get 40% extra charge",
                    benefits: ["800,000 Toman bonus credit", "Phone support", "One year validity"],
                    auto_translated: false
                },
                {
                    language: Language.ar,
                    name: "باقة مليوني تومان",
                    description: "احصل على 40٪ شحن إضافي",
                    benefits: ["800,000 تومان رصيد مكافأة", "دعم هاتفي", "صلاحية سنة واحدة"],
                    auto_translated: true
                }
            ]
        },
        {
            level: 5,
            price: 5000000,
            credit_amount: 5000000,
            bonus_credit: 3000000,
            total_credit: 8000000,
            expiry_days: 365,
            status: PlanStatus.ACTIVE,
            is_popular: false,
            contents: [
                {
                    language: Language.fa,
                    name: "بسته شارژ پنج میلیون تومانی",
                    description: "۶۰٪ شارژ اضافه دریافت کنید",
                    benefits: ["۳,۰۰۰,۰۰۰ تومان اعتبار هدیه", "پشتیبانی اختصاصی", "مدیر حساب اختصاصی"],
                    auto_translated: false
                },
                {
                    language: Language.en,
                    name: "5 Million Toman Package",
                    description: "Get 60% extra charge",
                    benefits: ["3,000,000 Toman bonus credit", "Dedicated support", "Account manager"],
                    auto_translated: false
                },
                {
                    language: Language.ar,
                    name: "باقة 5 ملايين تومان",
                    description: "احصل على 60٪ شحن إضافي",
                    benefits: ["3,000,000 تومان رصيد مكافأة", "دعم مخصص", "مدير حساب مخصص"],
                    auto_translated: true
                }
            ]
        },
        {
            level: 6,
            price: 10000000,
            credit_amount: 10000000,
            bonus_credit: 8000000,
            total_credit: 18000000,
            expiry_days: 365,
            status: PlanStatus.ACTIVE,
            is_popular: false,
            contents: [
                {
                    language: Language.fa,
                    name: "بسته شارژ ده میلیون تومانی",
                    description: "۸۰٪ شارژ اضافه دریافت کنید",
                    benefits: ["۸,۰۰۰,۰۰۰ تومان اعتبار هدیه", "پشتیبانی اختصاصی", "مدیر حساب اختصاصی", "اولویت در نمایش"],
                    auto_translated: false
                },
                {
                    language: Language.en,
                    name: "10 Million Toman Package",
                    description: "Get 80% extra charge",
                    benefits: ["8,000,000 Toman bonus credit", "Dedicated support", "Account manager", "Priority display"],
                    auto_translated: false
                },
                {
                    language: Language.ar,
                    name: "باقة 10 ملايين تومان",
                    description: "احصل على 80٪ شحن إضافي",
                    benefits: ["8,000,000 تومان رصيد مكافأة", "دعم مخصص", "مدير حساب مخصص", "الأولوية في العرض"],
                    auto_translated: true
                }
            ]
        }
    ];

    for (const planData of plans) {
        const plan = await prisma.plan.create({
            data: {
                level: planData.level,
                price: planData.price,
                credit_amount: planData.credit_amount,
                bonus_credit: planData.bonus_credit,
                total_credit: planData.total_credit,
                expiry_days: planData.expiry_days,
                status: planData.status,
                is_popular: planData.is_popular,
                contents: {
                    create: planData.contents
                }
            }
        });
        console.log(`✅ Plan level ${plan.level} created (ID: ${plan.id})`);
    }

    console.log('🎉 Plans seeding completed!');
}

// برای اجرای مستقل
if (require.main === module) {
    seedPlans()
        .catch(console.error)
        .finally(() => prisma.$disconnect());
}

export { seedPlans };