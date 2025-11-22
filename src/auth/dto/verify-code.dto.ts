import { IsNotEmpty, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class VerifyCodeDto {
    @ApiProperty({ example: "989196421264" })
    @IsString()
    @IsNotEmpty()
    mobile: string;

    @ApiProperty({ example: "12345" })
    @IsString()
    @IsNotEmpty()
    code: string;
}