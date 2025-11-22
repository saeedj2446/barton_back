import { PartialType } from '@nestjs/swagger';
import { CreateIndustryRelationDto } from './create-industry-relation.dto';

export class UpdateIndustryRelationDto extends PartialType(CreateIndustryRelationDto) {}