// src/common/decorators/language.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Language } from '@prisma/client';

export const LanguageHeader = createParamDecorator(
    (data: unknown, ctx: ExecutionContext): Language => {
        const request = ctx.switchToHttp().getRequest();

        // 1. Check query parameter first
        const queryLang = request.query.lang;
        if (queryLang && Object.values(Language).includes(queryLang as Language)) {
            return queryLang as Language;
        }

        // 2. Check custom header
        const headerLang = request.headers['x-app-language'];
        if (headerLang && Object.values(Language).includes(headerLang as Language)) {
            return headerLang as Language;
        }

        // 3. Check Accept-Language header
        const acceptLanguage = request.headers['accept-language'];
        if (acceptLanguage) {
            const primaryLang = acceptLanguage.split(',')[0].split('-')[0];
            if (Object.values(Language).includes(primaryLang as Language)) {
                return primaryLang as Language;
            }
        }

        // 4. Check user profile language (if authenticated)
        if (request.user?.language) {
            return request.user.language;
        }

        // 5. Default fallback
        return Language.fa;
    },
);