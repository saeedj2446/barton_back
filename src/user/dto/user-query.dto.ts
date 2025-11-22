import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {Language, SystemRole, UserSex} from '@prisma/client';



export class UserQueryDto {
    @ApiProperty({ required: false, default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    page?: number = 1;

    @ApiProperty({ required: false, default: 10 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    limit?: number = 10;

    @ApiProperty({ enum: SystemRole, required: false })
    @IsOptional()
    @IsEnum(SystemRole)
    role?: SystemRole;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiProperty({ required: false, default: 'created_at' })
    @IsOptional()
    @IsString()
    sortBy?: string = 'created_at';

    @ApiProperty({ enum: ['asc', 'desc'], required: false, default: 'desc' })
    @IsOptional()
    @IsEnum(['asc', 'desc'])
    sortOrder?: 'asc' | 'desc' = 'desc';

    @ApiProperty({ required: false })
    @IsOptional()
    @Type(() => Boolean)
    is_active?: boolean;

    @ApiProperty({ enum: Language, required: false })
    @IsOptional()
    @IsEnum(Language)
    language?: Language;

    @ApiProperty({ enum: UserSex, required: false })
    @IsOptional()
    @IsEnum(UserSex)
    sex?: UserSex;
}