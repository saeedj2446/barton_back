// src/comments/dto/update-comment.dto.ts
import {ApiProperty, PartialType} from '@nestjs/swagger';
import { CreateCommentDto } from './create-comment.dto';
import {IsBoolean, IsOptional} from "class-validator";

export class UpdateCommentDto extends PartialType(CreateCommentDto) {
    @ApiProperty({ description: 'تأیید کامنت', required: false })
    @IsBoolean()
    @IsOptional()
    confirmed?: boolean;
}
