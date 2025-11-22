// src/category-specs/dto/update-category-spec.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateCategorySpecDto } from './create-category-spec.dto';

export class UpdateCategorySpecDto extends PartialType(CreateCategorySpecDto) {}