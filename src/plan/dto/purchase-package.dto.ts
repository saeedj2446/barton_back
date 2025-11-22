// src/plan/dto/purchase-package.dto.ts
import { IsInt, IsEnum, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';

export class PurchasePackageDto {
    @ApiProperty({ description: 'سطح پکیج مورد نظر', example: 3 })
    @IsInt()
    @Min(1)
    packageLevel: number;

    @ApiProperty({ enum: PaymentMethod, description: 'روش پرداخت' })
    @IsEnum(PaymentMethod)
    paymentMethod: PaymentMethod;
}