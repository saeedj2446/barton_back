import { type ExceptionFilter, Catch, type ArgumentsHost, HttpException, HttpStatus, Logger } from "@nestjs/common"
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

    if (exception instanceof HttpException) {
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
