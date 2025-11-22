// src/reviews/dto/update-review.dto.ts
import {ApiProperty, PartialType} from '@nestjs/swagger';
import { CreateReviewDto } from './create-review.dto';
import {IsBoolean, IsOptional} from "class-validator";

export class UpdateReviewDto extends PartialType(CreateReviewDto) {
    @ApiProperty({ description: 'تأیید نظر', required: false })
    @IsBoolean()
    @IsOptional()
    confirmed?: boolean;
}