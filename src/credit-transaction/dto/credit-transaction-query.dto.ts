// src/credit/credit-transaction/dto/credit-transaction-query.dto.ts
import { IsOptional, IsInt, IsString, IsEnum, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TransactionType } from '@prisma/client';

export class CreditTransactionQueryDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsInt()
    page?: number = 1;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsInt()
    limit?: number = 10;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    user_id?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    activity_type?: string;

    @ApiProperty({ enum: TransactionType, required: false })
    @IsOptional()
    @IsEnum(TransactionType)
    transactionType?: TransactionType;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    startDate?: Date;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    endDate?: Date;
}