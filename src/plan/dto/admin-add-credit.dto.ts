// src/plan/dto/admin-add-credit.dto.ts
import { IsString, IsInt, IsEnum, Min, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdminAddCreditDto {
    @ApiProperty({ description: 'شناسه کاربر' })
    @IsString()
    user_id: string;

    @ApiProperty({ description: 'مبلغ اعتبار', example: 50000 })
    @IsInt()
    @Min(1)
    amount: number;

    @ApiProperty({
        description: 'نوع اعتبار',
        enum: ['CURRENT', 'BONUS'],
        example: 'CURRENT'
    })
    @IsEnum(['CURRENT', 'BONUS'])
    creditType: 'CURRENT' | 'BONUS';

    @ApiProperty({ description: 'توضیحات', required: false })
    @IsOptional()
    @IsString()
    description?: string;
}


