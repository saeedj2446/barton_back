// src/auth/verification.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class VerificationService {
    private readonly logger = new Logger(VerificationService.name);

    constructor(private prisma: PrismaService) {}

    // ایجاد کد تأیید ۶ رقمی
    generateVerificationCode(): string {
        return crypto.randomInt(10000, 99999).toString(); // 5 رقمی
    }

    // ذخیره کد تأیید در دیتابیس
    async createVerificationCode(mobile: string): Promise<string> {
        const code = this.generateVerificationCode();
        const expires_at = new Date(Date.now() + 2 * 60 * 1000); // 2 دقیقه اعتبار

        // حذف کدهای قبلی برای این شماره موبایل
        await this.prisma.verificationCode.deleteMany({
            where: { mobile },
        });

        // ذخیره کد جدید
        await this.prisma.verificationCode.create({
            data: {
                code,
                mobile,
                expires_at,
            },
        });

        this.logger.log(`Verification code created for ${mobile}: ${code}`);
        return code;
    }

    // تأیید صحت کد
    async verifyCode(mobile: string, code: string): Promise<boolean> {
        const verification = await this.prisma.verificationCode.findFirst({
            where: {
                mobile,
                code,
                expires_at: { gt: new Date() },
            },
        });

        if (verification) {
            this.logger.log(`Code verified for ${mobile}`);
            // پس از تأیید، کد را حذف می‌کنیم
            await this.deleteVerificationCode(mobile);
            return true;
        }

        this.logger.warn(`Invalid code attempt for ${mobile}: ${code}`);
        return false;
    }

    // حذف کد تأیید پس از استفاده
    async deleteVerificationCode(mobile: string): Promise<void> {
        await this.prisma.verificationCode.deleteMany({
            where: { mobile },
        });
        this.logger.log(`Verification codes deleted for ${mobile}`);
    }

    // 🔥 NEW: دریافت کد فعال برای یک شماره موبایل
    async getActiveVerificationCode(mobile: string): Promise<any> {
        const code = await this.prisma.verificationCode.findFirst({
            where: {
                mobile,
                expires_at: {
                    gt: new Date()
                },
            },
        });

        if (code) {
            this.logger.log(`Active code found for ${mobile}: ${code.code}`);
        } else {
            this.logger.log(`No active code found for ${mobile}`);
        }

        return code;
    }

    // 🔥 NEW: تمدید زمان انقضای کد تأیید
    async updateVerificationCodeExpiry(mobile: string, code: string): Promise<void> {
        const newExpiry = new Date();
        newExpiry.setMinutes(newExpiry.getMinutes() + 2); // تمدید 2 دقیقه‌ای

        const updated = await this.prisma.verificationCode.updateMany({
            where: {
                mobile,
                code,
                expires_at: {
                    gt: new Date()
                },
            },
            data: {
                expires_at: newExpiry
            }
        });

        if (updated.count > 0) {
            this.logger.log(`Code expiry extended for ${mobile} until ${newExpiry}`);
        } else {
            this.logger.warn(`No active code found to extend for ${mobile}`);
        }
    }

    // 🔥 NEW: بررسی وجود کد فعال
    async hasActiveVerificationCode(mobile: string): Promise<boolean> {
        const count = await this.prisma.verificationCode.count({
            where: {
                mobile,
                expires_at: {
                    gt: new Date()
                },
            },
        });

        return count > 0;
    }
}