import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsEnum, Min } from 'class-validator';
import { TransactionType, PaymentMethod } from '@prisma/client';

export class CreateTransactionDto {
    @ApiProperty({ description: 'شناسه سفارش' })
    @IsString()
    order_id: string;

    @ApiProperty({ description: 'مبلغ تراکنش (ریال)' })
    @IsNumber()
    @Min(1)
    amount: number;

    @ApiProperty({ enum: TransactionType, description: 'نوع تراکنش' })
    @IsEnum(TransactionType)
    transaction_type: TransactionType;

    @ApiProperty({ enum: PaymentMethod, description: 'روش پرداخت', required: false })
    @IsEnum(PaymentMethod)
    @IsOptional()
    payment_method?: PaymentMethod;

    @ApiProperty({ description: 'کارمزد (ریال)', required: false })
    @IsNumber()
    @Min(0)
    @IsOptional()
    fee?: number;

    @ApiProperty({ description: 'توضیحات', required: false })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ description: 'یادداشت', required: false })
    @IsString()
    @IsOptional()
    notes?: string;
}