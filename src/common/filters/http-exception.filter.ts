// src/common/filters/http-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger
} from "@nestjs/common"
import { ThrottlerException } from '@nestjs/throttler';
import type { FastifyRequest, FastifyReply } from "fastify"

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const request = ctx.getRequest<FastifyRequest>()
    const response = ctx.getResponse<FastifyReply>()

    let status = HttpStatus.INTERNAL_SERVER_ERROR
    let message = "Internal server error"

    // 🆕 هندل کردن ThrottlerException
    if (exception instanceof ThrottlerException) {
      status = exception.getStatus()

      // پیام‌های فارسی مخصوص هر endpoint
      const url = request.url;
      if (url.includes('/auth/mobile/request')) {
        message = 'تعداد درخواست‌های ارسال کد تأیید بیش از حد مجاز است. لطفاً ۱ دقیقه صبر کنید.';
      } else if (url.includes('/auth/mobile/verify')) {
        message = 'تعداد تلاش برای تأیید کد بیش از حد مجاز است. لطفاً ۱ دقیقه صبر کنید.';
      } else if (url.includes('/auth/login')) {
        message = 'تعداد تلاش برای ورود بیش از حد مجاز است. لطفاً ۵ دقیقه صبر کنید.';
      } else if (url.includes('/auth/mobile/complete')) {
        message = 'تعداد درخواست‌های تکمیل ثبت‌نام بیش از حد مجاز است. لطفاً ۵ دقیقه صبر کنید.';
      } else {
        message = 'درخواست‌های شما بیش از حد مجاز است. لطفاً چند لحظه صبر کنید.';
      }
    }
    // هندل کردن سایر HttpException ها
    else if (exception instanceof HttpException) {
      status = exception.getStatus()
      const exceptionResponse = exception.getResponse()
      message =
          typeof exceptionResponse === "string"
              ? exceptionResponse
              : (exceptionResponse as any).message || exception.message
    }

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message: Array.isArray(message) ? message : [message],
    }

    this.logger.error(
        `${request.method} ${request.url} - ${status} - ${JSON.stringify(message)}`,
        exception instanceof Error ? exception.stack : undefined,
    )

    response.status(status).send(errorResponse)
  }
}