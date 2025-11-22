// src/credit/credit-transaction/dto/create-credit-transaction.dto.ts
import { IsString, IsInt, IsEnum, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TransactionType } from '@prisma/client';

export class CreateCreditTransactionDto {
    @ApiProperty({ description: 'شناسه کاربر' })
    @IsString()
    user_id: string;

    @ApiProperty({ description: 'مبلغ تراکنش (مثبت برای شارژ، منفی برای مصرف)' })
    @IsInt()
    amount: number;

    @ApiProperty({ description: 'نوع فعالیت', example: 'PACKAGE_PURCHASE' })
    @IsString()
    activity_type: string;

    @ApiProperty({ enum: TransactionType })
    @IsEnum(TransactionType)
    credit_transaction_type: TransactionType;

    @ApiProperty({ description: 'توضیحات', required: false })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ description: 'تعداد', required: false })
    @IsOptional()
    @IsInt()
    @Min(1)
    quantity?: number;

    @ApiProperty({ description: 'شناسه اکانت', required: false })
    @IsOptional()
    @IsString()
    account_id?: string;

    @ApiProperty({ description: 'شناسه محصول', required: false })
    @IsOptional()
    @IsString()
    product_id?: string;

    @ApiProperty({ description: 'شناسه تراکنش اصلی', required: false })
    @IsOptional()
    @IsString()
    transaction_id?: string;
}


