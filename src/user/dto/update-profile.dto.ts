// src/user/dto/update-profile.dto.ts
import { IsEmail, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProfileDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    first_name?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    last_name?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    mobile?: string;


    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    province?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    city?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    activity_type?: string;

    @ApiProperty({ example: "MAN", required: false })
    @IsString()
    @IsOptional()
    sex?: string;
}