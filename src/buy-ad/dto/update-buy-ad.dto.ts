// src/buy-ad/dto/update-buy-ad.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateBuyAdDto } from './create-buy-ad.dto';

export class UpdateBuyAdDto extends PartialType(CreateBuyAdDto) {
    // تمام فیلدها به صورت optional هستند
    // نیازی به تعریف مجدد فیلدها نیست
}