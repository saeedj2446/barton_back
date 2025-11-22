import { Injectable } from '@nestjs/common';
import { Language } from '@prisma/client';
import { errorFa, errorEn, errorAr } from './errors';

@Injectable()
export class I18nService {
    private readonly translations = {
        [Language.fa]: errorFa,
        [Language.en]: errorEn,
        [Language.ar]: errorAr,
        // fallback برای زبان‌های دیگر
        [Language.tr]: errorEn,
        [Language.de]: errorEn,
        [Language.fr]: errorEn,
        [Language.es]: errorEn,
        [Language.zh]: errorEn,
        [Language.ru]: errorEn,
    };

    translate(
        key: string,
        language: Language = Language.fa,
        params: Record<string, any> = {}
    ): string {
        // اول زبان درخواستی رو چک کن
        let translation = this.translations[language]?.[key];

        // اگر نبود، فارسی رو چک کن
        if (!translation) {
            translation = this.translations[Language.fa]?.[key];
        }

        // اگر بازهم نبود، خود کلید رو برگردون
        if (!translation) {
            translation = key;
        }

        // جایگزینی پارامترها
        let result = translation;
        for (const [paramKey, paramValue] of Object.entries(params)) {
            result = result.replace(new RegExp(`{${paramKey}}`, 'g'), String(paramValue));
        }

        return result;
    }

    t(key: string, language: Language = Language.fa, params: Record<string, any> = {}): string {
        return this.translate(key, language, params);
    }
}