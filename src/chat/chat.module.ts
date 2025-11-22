// src/chat/chat.module.ts
import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { MessagesModule } from '../messages/messages.module';
import { ConversationsModule } from '../conversations/conversations.module';
// ❌ فعلا از کش مموری به جای ردیس استفاده می کنیم
// import { RedisService } from '../cache/redis.service';

@Module({
    imports: [
        MessagesModule,
        ConversationsModule,
    ],
    providers: [
        ChatGateway,
        // ❌ RedisService رو از اینجا هم حذف کن
    ],
    exports: [ChatGateway],
})
export class ChatModule {}