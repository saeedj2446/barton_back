// dto/credit-update.dto.ts
import { IsNumber, IsEnum, IsPositive, Min } from 'class-validator';

export class CreditUpdateDto {
    @IsNumber()
    @IsPositive()
    amount: number;

    @IsEnum(['add', 'subtract', 'set'])
    type: 'add' | 'subtract' | 'set';
}