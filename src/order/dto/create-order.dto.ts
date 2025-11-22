import { ApiProperty } from '@nestjs/swagger';
import {
    IsString, IsNumber, IsOptional, IsArray,
    ValidateNested, IsEnum, IsBoolean, Min
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrderType, PaymentMethod } from '@prisma/client';

export class OrderItemDto {
    @ApiProperty({ description: 'شناسه محصول' })
    @IsString()
    product_id: string;

    @ApiProperty({ description: 'تعداد' })
    @IsNumber()
    @Min(1)
    quantity: number;

    @ApiProperty({ description: 'قیمت واحد (ریال)' })
    @IsNumber()
    @Min(0)
    unit_price: number;

    @ApiProperty({ description: 'توضیحات آیتم', required: false })
    @IsString()
    @IsOptional()
    description?: string;
}

export class CreateOrderDto {
    @ApiProperty({ description: 'نوع سفارش', enum: OrderType })
    @IsEnum(OrderType)
    order_type: OrderType;

    @ApiProperty({ description: 'شناسه اکانت' })
    @IsString()
    account_id: string;

    @ApiProperty({ description: 'روش پرداخت', enum: PaymentMethod, required: false })
    @IsEnum(PaymentMethod)
    @IsOptional()
    payment_method?: PaymentMethod;

    @ApiProperty({ description: 'آیتم‌های سفارش', type: [OrderItemDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => OrderItemDto)
    items: OrderItemDto[];

    @ApiProperty({ description: 'آدرس تحویل', required: false })
    @IsString()
    @IsOptional()
    shipping_address?: string;

    @ApiProperty({ description: 'توضیحات سفارش', required: false })
    @IsString()
    @IsOptional()
    notes?: string;
}