import { IsEmail, IsNotEmpty, IsString, IsOptional, IsEnum } from "class-validator"
import { ApiProperty } from "@nestjs/swagger"
import { Role } from "@prisma/client"

export class CreateUserDto {
  @ApiProperty({ example: "user@example.com" })
  @IsEmail()
  @IsNotEmpty()
  email: string

  @ApiProperty({ example: "password123" })
  @IsString()
  @IsNotEmpty()
  password: string

  @ApiProperty({ example: "John" })
  @IsString()
  @IsNotEmpty()
  firstName: string

  @ApiProperty({ example: "Doe" })
  @IsString()
  @IsNotEmpty()
  lastName: string

  @ApiProperty({ example: "+1234567890", required: false })
  @IsString()
  @IsOptional()
  phone?: string

  @ApiProperty({ enum: Role, default: Role.USER, required: false })
  @IsEnum(Role)
  @IsOptional()
  role?: Role
}
