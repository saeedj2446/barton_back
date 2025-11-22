import { HttpException, HttpStatus } from '@nestjs/common';
import { I18nService } from '../../i18n/i18n.service';
import { Language } from '@prisma/client';

export class I18nException extends HttpException {
    constructor(
        messageKey: string,
        language: Language = Language.fa,
        params: Record<string, any> = {},
        status: HttpStatus = HttpStatus.BAD_REQUEST
    ) {
        const i18nService = new I18nService();
        const message = i18nService.translate(messageKey, language, params);
        super(message, status);
    }
}

// ==================== 4xx Client Errors ====================

// 400 - Bad Request
export class I18nBadRequestException extends I18nException {
    constructor(messageKey: string, language: Language = Language.fa, params: Record<string, any> = {}) {
        super(messageKey, language, params, HttpStatus.BAD_REQUEST);
    }
}

// 401 - Unauthorized
export class I18nUnauthorizedException extends I18nException {
    constructor(messageKey: string, language: Language = Language.fa, params: Record<string, any> = {}) {
        super(messageKey, language, params, HttpStatus.UNAUTHORIZED);
    }
}

// 403 - Forbidden
export class I18nForbiddenException extends I18nException {
    constructor(messageKey: string, language: Language = Language.fa, params: Record<string, any> = {}) {
        super(messageKey, language, params, HttpStatus.FORBIDDEN);
    }
}

// 404 - Not Found
export class I18nNotFoundException extends I18nException {
    constructor(messageKey: string, language: Language = Language.fa, params: Record<string, any> = {}) {
        super(messageKey, language, params, HttpStatus.NOT_FOUND);
    }
}

// 405 - Method Not Allowed
export class I18nMethodNotAllowedException extends I18nException {
    constructor(messageKey: string, language: Language = Language.fa, params: Record<string, any> = {}) {
        super(messageKey, language, params, HttpStatus.METHOD_NOT_ALLOWED);
    }
}

// 406 - Not Acceptable
export class I18nNotAcceptableException extends I18nException {
    constructor(messageKey: string, language: Language = Language.fa, params: Record<string, any> = {}) {
        super(messageKey, language, params, HttpStatus.NOT_ACCEPTABLE);
    }
}

// 408 - Request Timeout
export class I18nRequestTimeoutException extends I18nException {
    constructor(messageKey: string, language: Language = Language.fa, params: Record<string, any> = {}) {
        super(messageKey, language, params, HttpStatus.REQUEST_TIMEOUT);
    }
}

// 409 - Conflict
export class I18nConflictException extends I18nException {
    constructor(messageKey: string, language: Language = Language.fa, params: Record<string, any> = {}) {
        super(messageKey, language, params, HttpStatus.CONFLICT);
    }
}

// 410 - Gone
export class I18nGoneException extends I18nException {
    constructor(messageKey: string, language: Language = Language.fa, params: Record<string, any> = {}) {
        super(messageKey, language, params, HttpStatus.GONE);
    }
}

// 412 - Precondition Failed
export class I18nPreconditionFailedException extends I18nException {
    constructor(messageKey: string, language: Language = Language.fa, params: Record<string, any> = {}) {
        super(messageKey, language, params, HttpStatus.PRECONDITION_FAILED);
    }
}

// 413 - Payload Too Large
export class I18nPayloadTooLargeException extends I18nException {
    constructor(messageKey: string, language: Language = Language.fa, params: Record<string, any> = {}) {
        super(messageKey, language, params, HttpStatus.PAYLOAD_TOO_LARGE);
    }
}

// 415 - Unsupported Media Type
export class I18nUnsupportedMediaTypeException extends I18nException {
    constructor(messageKey: string, language: Language = Language.fa, params: Record<string, any> = {}) {
        super(messageKey, language, params, HttpStatus.UNSUPPORTED_MEDIA_TYPE);
    }
}

// 422 - Unprocessable Entity
export class I18nUnprocessableEntityException extends I18nException {
    constructor(messageKey: string, language: Language = Language.fa, params: Record<string, any> = {}) {
        super(messageKey, language, params, HttpStatus.UNPROCESSABLE_ENTITY);
    }
}

// 429 - Too Many Requests
export class I18nTooManyRequestsException extends I18nException {
    constructor(messageKey: string, language: Language = Language.fa, params: Record<string, any> = {}) {
        super(messageKey, language, params, HttpStatus.TOO_MANY_REQUESTS);
    }
}

// ==================== 5xx Server Errors ====================

// 500 - Internal Server Error
export class I18nInternalServerErrorException extends I18nException {
    constructor(messageKey: string, language: Language = Language.fa, params: Record<string, any> = {}) {
        super(messageKey, language, params, HttpStatus.INTERNAL_SERVER_ERROR);
    }
}

// 501 - Not Implemented
export class I18nNotImplementedException extends I18nException {
    constructor(messageKey: string, language: Language = Language.fa, params: Record<string, any> = {}) {
        super(messageKey, language, params, HttpStatus.NOT_IMPLEMENTED);
    }
}

// 502 - Bad Gateway
export class I18nBadGatewayException extends I18nException {
    constructor(messageKey: string, language: Language = Language.fa, params: Record<string, any> = {}) {
        super(messageKey, language, params, HttpStatus.BAD_GATEWAY);
    }
}

// 503 - Service Unavailable
export class I18nServiceUnavailableException extends I18nException {
    constructor(messageKey: string, language: Language = Language.fa, params: Record<string, any> = {}) {
        super(messageKey, language, params, HttpStatus.SERVICE_UNAVAILABLE);
    }
}

// 504 - Gateway Timeout
export class I18nGatewayTimeoutException extends I18nException {
    constructor(messageKey: string, language: Language = Language.fa, params: Record<string, any> = {}) {
        super(messageKey, language, params, HttpStatus.GATEWAY_TIMEOUT);
    }
}