import { IsNotEmpty, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class MobileRequestDto {
    @ApiProperty({ example: "989196421264" })
    @IsString()
    @IsNotEmpty()
    mobile: string;
}