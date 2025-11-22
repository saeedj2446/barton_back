// src/chat/redis-adapter.config.ts
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import {RedisService} from "../redis/redis.service";


export class RedisIoAdapter extends IoAdapter {
    constructor(
        private app: any,
        private redisService: RedisService,
    ) {
        super(app);
    }

    createIOServer(port: number, options?: ServerOptions): any {
        const server = super.createIOServer(port, options);

        try {
            const redisClient = this.redisService.getClient();
            if (redisClient && redisClient.status === 'ready') {
                const pubClient = redisClient;
                const subClient = pubClient.duplicate();

                const redisAdapter = createAdapter(pubClient, subClient);
                server.adapter(redisAdapter);
                console.log('✅ Redis Adapter for WebSocket initialized successfully');
            } else {
                console.log('⚠️ Redis Client not ready, using default WebSocket adapter');
            }
        } catch (error) {
            console.error('❌ Error initializing Redis Adapter:', error);
            console.log('⚠️ Falling back to default WebSocket adapter');
        }

        return server;
    }
}