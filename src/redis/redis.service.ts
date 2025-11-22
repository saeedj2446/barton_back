// src/cache/redis.service.ts
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(RedisService.name);
    private redisClient: Redis;
    private isConnected: boolean = false;

    constructor(private configService: ConfigService) {}

    async onModuleInit() {
        await this.initializeRedisClient();
    }

    async onModuleDestroy() {
        await this.disconnect();
    }

    private async initializeRedisClient() {
        try {
            const redisConfig = {
                host: this.configService.get('REDIS_HOST', 'localhost'),
                port: this.configService.get('REDIS_PORT', 6379),
                password: this.configService.get('REDIS_PASSWORD'),
                db: this.configService.get('REDIS_DB', 0),
                retryDelayOnFailover: 100,
                maxRetriesPerRequest: 3,
                lazyConnect: true,
                connectTimeout: 10000, // 10 seconds timeout
                commandTimeout: 5000, // 5 seconds command timeout
            };

            this.redisClient = new Redis(redisConfig);

            // Event listeners
            this.redisClient.on('connect', () => {
                this.isConnected = true;
                this.logger.log('✅ Redis Client connected successfully');
            });

            this.redisClient.on('ready', () => {
                this.logger.log('✅ Redis Client ready for operations');
            });

            this.redisClient.on('error', (err) => {
                this.isConnected = false;
                this.logger.error('❌ Redis Client Error', err.message);
            });

            this.redisClient.on('close', () => {
                this.isConnected = false;
                this.logger.warn('🔌 Redis connection closed');
            });

            this.redisClient.on('reconnecting', () => {
                this.logger.log('🔄 Redis Client reconnecting...');
            });

            // Wait for connection
            await this.redisClient.connect();

            // Test connection
            const pingResult = await this.redisClient.ping();
            if (pingResult === 'PONG') {
                this.logger.log('✅ Redis connection test successful');
            } else {
                throw new Error(`Unexpected ping response: ${pingResult}`);
            }

        } catch (error) {
            this.logger.error('❌ Failed to initialize Redis client', error.message);
            this.isConnected = false;
            // Don't throw error to prevent app from crashing
        }
    }

    private async disconnect() {
        if (this.redisClient) {
            try {
                await this.redisClient.quit();
                this.logger.log('✅ Redis Client disconnected gracefully');
            } catch (error) {
                this.logger.error('❌ Error disconnecting Redis client', error.message);
            }
        }
    }

    // 🔹 متدهای مدیریت کاربران آنلاین برای چت
    async setUserOnline(userId: string, socketId: string): Promise<boolean> {
        if (!this.isConnected || !this.redisClient) return false;

        try {
            await Promise.all([
                this.redisClient.setex(`user:${userId}:socket`, 86400, socketId),
                this.redisClient.sadd('online_users', userId),
                this.redisClient.setex(`user:${userId}:last_seen`, 86400, new Date().toISOString()),
            ]);
            return true;
        } catch (error) {
            this.logger.error(`Error setting user ${userId} online`, error.message);
            return false;
        }
    }

    async setUserOffline(userId: string): Promise<boolean> {
        if (!this.isConnected || !this.redisClient) return false;

        try {
            await Promise.all([
                this.redisClient.del(`user:${userId}:socket`),
                this.redisClient.srem('online_users', userId),
            ]);
            return true;
        } catch (error) {
            this.logger.error(`Error setting user ${userId} offline`, error.message);
            return false;
        }
    }

    async isUserOnline(userId: string): Promise<boolean> {
        if (!this.isConnected || !this.redisClient) return false;

        try {
            return (await this.redisClient.sismember('online_users', userId)) === 1;
        } catch (error) {
            this.logger.error(`Error checking online status for user ${userId}`, error.message);
            return false;
        }
    }

    async getUserSocketId(userId: string): Promise<string | null> {
        if (!this.isConnected || !this.redisClient) return null;

        try {
            return await this.redisClient.get(`user:${userId}:socket`);
        } catch (error) {
            this.logger.error(`Error getting socket ID for user ${userId}`, error.message);
            return null;
        }
    }

    async getOnlineUsers(): Promise<string[]> {
        if (!this.isConnected || !this.redisClient) return [];

        try {
            return await this.redisClient.smembers('online_users');
        } catch (error) {
            this.logger.error('Error getting online users', error.message);
            return [];
        }
    }

    async getOnlineUsersCount(): Promise<number> {
        if (!this.isConnected || !this.redisClient) return 0;

        try {
            return await this.redisClient.scard('online_users');
        } catch (error) {
            this.logger.error('Error getting online users count', error.message);
            return 0;
        }
    }

    // 🔹 متدهای عمومی برای مدیریت کلیدها
    async set(key: string, value: string, ttl?: number): Promise<boolean> {
        if (!this.isConnected || !this.redisClient) return false;

        try {
            if (ttl) {
                await this.redisClient.setex(key, ttl, value);
            } else {
                await this.redisClient.set(key, value);
            }
            return true;
        } catch (error) {
            this.logger.error(`Error setting key: ${key}`, error.message);
            return false;
        }
    }

    async get(key: string): Promise<string | null> {
        if (!this.isConnected || !this.redisClient) return null;

        try {
            return await this.redisClient.get(key);
        } catch (error) {
            this.logger.error(`Error getting key: ${key}`, error.message);
            return null;
        }
    }

    async del(key: string): Promise<boolean> {
        if (!this.isConnected || !this.redisClient) return false;

        try {
            await this.redisClient.del(key);
            return true;
        } catch (error) {
            this.logger.error(`Error deleting key: ${key}`, error.message);
            return false;
        }
    }

    async exists(key: string): Promise<boolean> {
        if (!this.isConnected || !this.redisClient) return false;

        try {
            return (await this.redisClient.exists(key)) === 1;
        } catch (error) {
            this.logger.error(`Error checking existence for key: ${key}`, error.message);
            return false;
        }
    }

    async expire(key: string, ttl: number): Promise<boolean> {
        if (!this.isConnected || !this.redisClient) return false;

        try {
            return (await this.redisClient.expire(key, ttl)) === 1;
        } catch (error) {
            this.logger.error(`Error setting TTL for key: ${key}`, error.message);
            return false;
        }
    }

    // 🔹 متدهای برای مدیریت لیست‌ها
    async lpush(key: string, value: string): Promise<boolean> {
        if (!this.isConnected || !this.redisClient) return false;

        try {
            await this.redisClient.lpush(key, value);
            return true;
        } catch (error) {
            this.logger.error(`Error LPUSH for key: ${key}`, error.message);
            return false;
        }
    }

    async rpop(key: string): Promise<string | null> {
        if (!this.isConnected || !this.redisClient) return null;

        try {
            return await this.redisClient.rpop(key);
        } catch (error) {
            this.logger.error(`Error RPOP for key: ${key}`, error.message);
            return null;
        }
    }

    // 🔹 متد برای پاب/ساب (اگر نیاز شد)
    async publish(channel: string, message: string): Promise<boolean> {
        if (!this.isConnected || !this.redisClient) return false;

        try {
            await this.redisClient.publish(channel, message);
            return true;
        } catch (error) {
            this.logger.error(`Error publishing to channel: ${channel}`, error.message);
            return false;
        }
    }

    // 🔹 متد عمومی برای دسترسی مستقیم به Redis Client
    getClient(): Redis | null {
        return this.isConnected ? this.redisClient : null;
    }

    // 🔹 بررسی وضعیت اتصال
    getConnectionStatus(): boolean {
        return this.isConnected;
    }

    // 🔹 متد برای health check
    async healthCheck(): Promise<{ status: string; message: string }> {
        if (!this.isConnected || !this.redisClient) {
            return { status: 'error', message: 'Redis client not connected' };
        }

        try {
            const pingResult = await this.redisClient.ping();
            if (pingResult === 'PONG') {
                return { status: 'ok', message: 'Redis is healthy' };
            } else {
                return { status: 'error', message: `Unexpected ping response: ${pingResult}` };
            }
        } catch (error) {
            return { status: 'error', message: `Health check failed: ${error.message}` };
        }
    }
}