
// src/plan/dto/admin-deduct-credit.dto.ts
import { IsString, IsInt, Min, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdminDeductCreditDto {
    @ApiProperty({ description: 'شناسه کاربر' })
    @IsString()
    user_id: string;

    @ApiProperty({ description: 'مبلغ کسر', example: 50000 })
    @IsInt()
    @Min(1)
    amount: number;

    @ApiProperty({ description: 'توضیحات', required: false })
    @IsOptional()
    @IsString()
    description?: string;
}