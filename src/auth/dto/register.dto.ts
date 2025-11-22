import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional } from "class-validator"
import { ApiProperty } from "@nestjs/swagger"

export class RegisterDto {
  @ApiProperty({ example: "user@example.com" })
  @IsEmail()
  @IsOptional()
  email: string

  @ApiProperty({ example: "123456", minLength: 6 })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string

  @ApiProperty({ example: "John" })
  @IsString()
  @IsOptional()
  first_name: string

  @ApiProperty({ example: "Doe" })
  @IsString()
  @IsOptional()
  last_name: string

  @ApiProperty({ example: "989196421264", required: false })
  @IsString()
  @IsOptional()
  mobile?: string
}
