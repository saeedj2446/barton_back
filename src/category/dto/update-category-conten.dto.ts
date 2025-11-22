import {ApiProperty} from "@nestjs/swagger";
import {IsBoolean, IsOptional, IsString} from "class-validator";

export class UpdateCategoryContentDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    description?: string;


}