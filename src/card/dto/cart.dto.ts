import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AddToCartDto {
    @ApiProperty({ description: 'شناسه محصول' })
    @IsString()
    product_id: string;

    @ApiProperty({ description: 'تعداد' })
    @IsNumber()
    @Min(1)
    quantity: number;

    @ApiProperty({ description: 'شناسه اکانت' })
    @IsString()
    account_id: string;
}

export class UpdateCartItemDto {
    @ApiProperty({ description: 'تعداد جدید' })
    @IsNumber()
    @Min(0) // 0 برای حذف
    quantity: number;
}

export class CartResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    order_number: string;

    @ApiProperty()
    total_amount: number;

    @ApiProperty()
    total_items: number;

    @ApiProperty()
    items: any[];

    constructor(order: any) {
        this.id = order.id;
        this.order_number = order.order_number;
        this.total_amount = order.total_amount;
        this.total_items = order.items?.length || 0;
        this.items = order.items || [];
    }
}