import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsNumber, IsString } from 'class-validator';
import { TransactionStatus, TransactionType, PaymentMethod } from '@prisma/client';

export class TransactionQueryDto {
    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    page?: number;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    limit?: number;

    @ApiProperty({ enum: TransactionStatus, required: false })
    @IsEnum(TransactionStatus)
    @IsOptional()
    status?: TransactionStatus;

    @ApiProperty({ enum: TransactionType, required: false })
    @IsEnum(TransactionType)
    @IsOptional()
    transaction_type?: TransactionType;

    @ApiProperty({ enum: PaymentMethod, required: false })
    @IsEnum(PaymentMethod)
    @IsOptional()
    payment_method?: PaymentMethod;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    order_id?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    search?: string;
}