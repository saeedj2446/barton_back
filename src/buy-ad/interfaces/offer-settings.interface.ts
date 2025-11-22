// src/buy-ad/interfaces/offer-settings.interface.ts
import { PaymentMethodType } from '@prisma/client';

export interface BudgetRange {
    min?: number;
    max?: number;
}

export interface OfferSettings {
    allow_public_offers?: boolean;          // آیا همه می‌توانند پیشنهاد دهند؟
    allowed_categories?: string[];          // فقط صنف‌های خاص
    min_seller_rating?: number;             // حداقل امتیاز فروشنده
    budget_range?: BudgetRange;             // محدوده بودجه
    max_delivery_days?: number;             // حداکثر زمان تحویل
    required_certifications?: string[];     // گواهی‌های مورد نیاز
    payment_methods?: PaymentMethodType[];  // روش‌های پرداخت قابل قبول
    auto_expire_days?: number;              // پیشنهادات بعد از چند روز منقضی شوند
}