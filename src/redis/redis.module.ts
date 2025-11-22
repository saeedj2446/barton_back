// src/cache/cache.module.ts
import { Module, Global } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-store';
import { RedisService } from './redis.service';

@Global() // این ماژول در تمام پروژه در دسترس باشد
@Module({
    imports: [
        CacheModule.registerAsync({
            isGlobal: true, // کش در تمام پروژه در دسترس باشد
            useFactory: async (configService: ConfigService) => {
                const store = await redisStore({
                    socket: {
                        host: configService.get('REDIS_HOST', 'localhost'),
                        port: configService.get('REDIS_PORT', 6379),
                    },
                    password: configService.get('REDIS_PASSWORD'),
                    database: configService.get('REDIS_DB', 0),
                });

                return {
                    store: () => store,
                    ttl: configService.get('CACHE_TTL', 5 * 60 * 1000),
                    max: configService.get('CACHE_MAX_ITEMS', 100),
                };
            },
            inject: [ConfigService],
        }),
    ],
    providers: [RedisService],
    exports: [RedisService], // RedisService را export کنید
})
export class RedisModule {}