
// ==================== GENERATORS ====================

/**
 * تولید کد منحصر بفرد برای سفارش‌ها
 * نمونه: ORD1M5XK3A1B2C3D4E5
 */

export function generateUniqCode(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}${random}`.toUpperCase();
}

/**
 * تولید کد منحصر بفرد برای تراکنش‌ها
 * نمونه: TRX1M5XK3A1B2C3D4
 */


/**
 * تولید کد تأیید ۶ رقمی برای پیامک
 * نمونه: 123456
 */
export function generateTransactionCode(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `TX${timestamp}${random}`.toUpperCase();
}


/**
 * محاسبه تاریخ انقضا از امروز
 * days: تعداد روز از امروز
 */
export const calculateExpiryDate = (days: number): Date => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
};



// src/common/utility.ts