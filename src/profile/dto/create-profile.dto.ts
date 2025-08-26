import { IsNotEmpty, IsString, IsOptional, IsUrl } from "class-validator"
import { ApiProperty } from "@nestjs/swagger"

export class CreateProfileDto {
  @ApiProperty({ example: "My Business Profile" })
  @IsString()
  @IsNotEmpty()
  name: string

  @ApiProperty({ example: "Professional wholesale business", required: false })
  @IsString()
  @IsOptional()
  description?: string

  @ApiProperty({ example: "https://example.com/logo.png", required: false })
  @IsUrl()
  @IsOptional()
  logoUrl?: string

  @ApiProperty({ example: "+1234567890", required: false })
  @IsString()
  @IsOptional()
  phone?: string

  @ApiProperty({ example: "123 Business St, City, State", required: false })
  @IsString()
  @IsOptional()
  address?: string

  @ApiProperty({ example: "https://mybusiness.com", required: false })
  @IsUrl()
  @IsOptional()
  website?: string
}
