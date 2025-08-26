import { IsNotEmpty, IsString, IsOptional, IsBoolean, IsUUID } from "class-validator"
import { ApiProperty } from "@nestjs/swagger"

export class CreateCommentDto {
  @ApiProperty({ example: "This is a great product! What is the shipping cost?" })
  @IsString()
  @IsNotEmpty()
  content: string

  @ApiProperty({ example: false, required: false })
  @IsBoolean()
  @IsOptional()
  isAnswer?: boolean

  @ApiProperty({ example: "uuid-of-parent-comment", required: false })
  @IsUUID()
  @IsOptional()
  parentId?: string
}
