// src/plan/dto/purchase-plan.dto.ts
import { IsNumber, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';

export class PurchasePlanDto {
    @ApiProperty({ example: 1, description: 'سطح پلن (1, 2, 3, ...)' })
    @IsNumber()
    plan_level: number;

    @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.CREDIT_BALANCE })
    @IsEnum(PaymentMethod)
    payment_method: PaymentMethod;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    custom_amount?: number; // برای شارژ دلخواه
}