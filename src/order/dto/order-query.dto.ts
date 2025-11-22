import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsNumber, IsString } from 'class-validator';
import { OrderStatus, OrderType } from '@prisma/client';

export class OrderQueryDto {
    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    page?: number;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    limit?: number;

    @ApiProperty({ enum: OrderStatus, required: false })
    @IsEnum(OrderStatus)
    @IsOptional()
    status?: OrderStatus;

    @ApiProperty({ enum: OrderType, required: false })
    @IsEnum(OrderType)
    @IsOptional()
    order_type?: OrderType;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    account_id?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    search?: string;
}