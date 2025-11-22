// src/credit-activity/dto/update-credit-activity.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import {CreateCreditActivityDto} from "./credit-activity.dto";


export class UpdateCreditActivityDto extends PartialType(CreateCreditActivityDto) {}