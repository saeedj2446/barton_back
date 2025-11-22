// src/plan/dto/consume-credit.dto.ts
import { IsString, IsInt, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ConsumeCreditDto {
    @ApiProperty({ description: 'نوع فعالیت', example: 'PRODUCT_BOOST' })
    @IsString()
    activity_type: string;

    @ApiProperty({ description: 'تعداد واحد (در صورت نیاز)', example: 1, required: false })
    @IsOptional()
    @IsInt()
    @Min(1)
    quantity?: number;

    @ApiProperty({ description: 'شناسه هدف فعالیت', example: 'product_id', required: false })
    @IsOptional()
    @IsString()
    targetId?: string;

    @ApiProperty({ description: 'توضیحات اضافی', required: false })
    @IsOptional()
    @IsString()
    description?: string;
}