// src/common/interceptors/hash-password.interceptor.ts
import { Injectable, type NestInterceptor, type ExecutionContext, type CallHandler } from "@nestjs/common"
import type { Observable } from "rxjs"
import type { FastifyRequest } from "fastify"
import * as crypto from 'crypto'

@Injectable()
export class HashPasswordInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest<FastifyRequest>()
        const { body } = request

        this.hashPasswordInBody(body)

        return next.handle()
    }

    private hashPasswordInBody(body: any): void {
        if (!body || typeof body !== 'object') return

        const passwordFields = [
            'password',
            'currentPassword',
            'newPassword',
            'confirmPassword'
        ]

        passwordFields.forEach(field => {
            if (body[field] && typeof body[field] === 'string') {
                const hashField = `${field}Hash`
                body[hashField] = this.createHash(body[field])
                delete body[field] // حذف فیلد اصلی
            }
        })
    }

    private createHash(text: string): string {
        return crypto
            .createHash('sha256')
            .update(text)
            .digest('hex')
    }
}