import { Injectable, type NestInterceptor, type ExecutionContext, type CallHandler, Logger } from "@nestjs/common"
import type { Observable } from "rxjs"
import { tap } from "rxjs/operators"
import type { FastifyRequest } from "fastify"

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name)

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<FastifyRequest>()
    const { method, url } = request
    const now = Date.now()

    return next.handle().pipe(
      tap(() => {
        const responseTime = Date.now() - now
        this.logger.log(`${method} ${url} - ${responseTime}ms`)
      }),
    )
  }
}
