// src/plan/dto/plan-status.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class PlanStatusDto {
    @ApiProperty({ description: 'اعتبار قابل مصرف فعلی' })
    current_credit: number;

    @ApiProperty({ description: 'اعتبار هدیه' })
    bonus_credit: number;

    @ApiProperty({ description: 'مجموع اعتبار قابل استفاده' })
    totalAvailableCredit: number;

    @ApiProperty({ description: 'سطح اعتباری فعلی' })
    credit_level: number;

    @ApiProperty({ description: 'پکیج فعال' })
    activePackage: any;

    @ApiProperty({ description: 'تاریخ انقضای پکیج' })
    packageEnd?: Date;

    @ApiProperty({ description: 'روزهای باقی‌مانده تا انقضا' })
    daysRemaining?: number;
}