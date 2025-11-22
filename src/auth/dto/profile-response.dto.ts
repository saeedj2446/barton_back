import { ApiProperty } from '@nestjs/swagger';

class PackageLimitDto {
    @ApiProperty()
    id: number;

    @ApiProperty()
    function: string;

    @ApiProperty()
    functionLabel: string;

    @ApiProperty()
    period: string;

    @ApiProperty()
    periodLabel: string;

    @ApiProperty()
    value: number | null;
}

class PackageFeeDto {
    @ApiProperty()
    id: number;

    @ApiProperty()
    function: string;

    @ApiProperty()
    functionLabel: string;

    @ApiProperty()
    percentage: number;

    @ApiProperty()
    side: string;

    @ApiProperty()
    description: string;
}

class PlanDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    packageId: number;

    @ApiProperty()
    paymentType: string;

    @ApiProperty()
    usageStart: Date;

    @ApiProperty()
    usageEnd: Date;

    @ApiProperty()
    is_active: boolean;

    @ApiProperty()
    isReserved: boolean;

    @ApiProperty()
    package?: {
        title: string;
        description: string;
        limitList: PackageLimitDto[];
        feeList: PackageFeeDto[];
    };
}

class AccountDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    title: string;

    @ApiProperty()
    provider: any;

    @ApiProperty()
    status: string;

    @ApiProperty()
    createdOn: Date;

    @ApiProperty({ type: PlanDto, nullable: true })
    activePlan?: PlanDto | null;

    @ApiProperty({ type: PlanDto, nullable: true })
    reservedPlan?: PlanDto | null;
}

export class ProfileResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    mobile: string;

    @ApiProperty()
    first_name: string;

    @ApiProperty()
    last_name: string;

    @ApiProperty()
    role: string;

    @ApiProperty()
    is_active: boolean;

    @ApiProperty({ type: [AccountDto] })
    accounts: AccountDto[];
}