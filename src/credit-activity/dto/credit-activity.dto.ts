// src/credit-activity/dto/create-credit-activity.dto.ts
import { CreditActivityType, CreditActivityStatus } from '@prisma/client';
import { IsString, IsNumber, IsOptional, IsEnum } from 'class-validator';

export class CreateCreditActivityDto {
    @IsString()
    user_id: string;

    @IsString()
    credit_transaction_id: string;

    @IsEnum(CreditActivityType)
    activity_type: CreditActivityType;

    @IsNumber()
    credit_amount: number;

    @IsNumber()
    @IsOptional()
    total_cost?: number;

    @IsEnum(CreditActivityStatus)
    @IsOptional()
    status?: CreditActivityStatus;

    @IsString()
    @IsOptional()
    description?: string;

    @IsString()
    @IsOptional()
    product_id?: string;

    @IsString()
    @IsOptional()
    account_id?: string;

    @IsString()
    @IsOptional()
    order_id?: string;

    @IsString()
    @IsOptional()
    buy_ad_id?: string;
}