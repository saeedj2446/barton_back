export const achievementBadges = {
    EARLY_ADOPTER: {
        name: "نوآور",
        description: "از اولین کاربران بارتون",
        icon: "🚀",
        requirements: { registration_before: "2024-12-31" },
        benefits: ["نمایش ویژه در نتایج جستجو"],
        is_purchasable: false
    },
    POWER_BUYER: {
        name: "خریدار قدرتمند",
        description: "بیش از ۱۰ میلیون تومان خرید موفق",
        icon: "💰",
        requirements: { total_purchases: 10000000 },
        benefits: ["تخفیف ویژه در خدمات"],
        is_purchasable: false
    },
    TRUSTED_SELLER: {
        name: "فروشنده معتمد",
        description: "فروش موفق با رضایت بالا",
        icon: "⭐",
        requirements: { successful_orders: 50, rating: 4.5 },
        benefits: ["تأیید سریع آگهی‌ها"],
        is_purchasable: false
    },
    CREDIT_MASTER: {
        name: "استاد شارژ",
        description: "مجموع شارژهای بیش از ۲۰ میلیون تومان",
        icon: "⚡",
        requirements: { total_charged: 20000000 },
        benefits: ["مدیریت پیشرفته شارژ"],
        is_purchasable: false
    }
};
