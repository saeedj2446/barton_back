// src/specs/dto/update-spec.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateSpecDto } from './create-spec.dto';

export class UpdateSpecDto extends PartialType(CreateSpecDto) {}