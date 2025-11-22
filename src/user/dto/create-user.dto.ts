import { IsEmail, IsNotEmpty, IsString, IsOptional, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class RegistrationDto {
  @ApiProperty({ example: "989196421264", required: false })
  @IsString()
  @IsOptional()
  @IsNotEmpty({ message: 'موبایل اجباری است' })
  mobile?: string;

  @ApiProperty({ example: "ora@gmail.com", required: false })
  @IsString()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: "123456", minLength: 6 })
  @IsString()
  @IsNotEmpty({ message: 'پسورد اجباری است' })
  @MinLength(6)
  password: string;

  @ApiProperty({ example: "John", required: false })
  @IsString()
  @IsOptional()
  first_name?: string;

  @ApiProperty({ example: "Doe", required: false })
  @IsString()
  @IsOptional()
  last_name?: string;

  @ApiProperty({ example: "MAN", required: false })
  @IsString()
  @IsOptional()
  sex?: string;

  // 🔥 اضافه کردن فیلدهای موقعیت جدید
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  location_level_1_id?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  location_level_2_id?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  location_level_3_id?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  location_level_4_id?: string;
}