import { IsNotEmpty, IsString, IsOptional, IsNumber } from "class-validator"
import { ApiProperty } from "@nestjs/swagger"
import { Transform } from "class-transformer"

export class CreateAdDto {
  @ApiProperty({ example: "High Quality Product for Sale" })
  @IsString()
  @IsNotEmpty()
  title: string

  @ApiProperty({ example: "Detailed description of the product..." })
  @IsString()
  @IsNotEmpty()
  description: string

  @ApiProperty({ example: 1000.5, required: false })
  @IsOptional()
  @Transform(({ value }) => Number.parseFloat(value))
  @IsNumber()
  price?: number

  @ApiProperty({ example: "Electronics" })
  @IsString()
  @IsNotEmpty()
  category: string

  @ApiProperty({ example: "New York, NY", required: false })
  @IsString()
  @IsOptional()
  location?: string
}
