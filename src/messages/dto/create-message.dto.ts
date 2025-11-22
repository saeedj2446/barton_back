// src/messages/dto/create-message.dto.ts
import { IsString, IsNotEmpty, IsOptional, IsMongoId, MaxLength } from 'class-validator';

export class CreateMessageDto {
    @IsMongoId()
    @IsNotEmpty()
    conversation_id: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(2000)
    content: string;

    @IsMongoId()
    @IsOptional()
    reply_to_message_id?: string;
}
