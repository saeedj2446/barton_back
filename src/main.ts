import { NestFactory } from "@nestjs/core"
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify"
import {BadRequestException, ValidationPipe} from "@nestjs/common"
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger"
import { AppModule } from "./app.module"
import { HttpExceptionFilter } from "./common/filters/http-exception.filter"
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor"

async function bootstrap() {
    const app = await NestFactory.create<NestFastifyApplication>(
        AppModule,
        new FastifyAdapter({
            logger: true,
            trustProxy: true
        })
    )
    // ✅ اضافه کردن Redis Adapter برای WebSocket
    /* try {
         const redisService = app.get(RedisService);
         const redisIoAdapter = new RedisIoAdapter(app, redisService);
         app.useWebSocketAdapter(redisIoAdapter);
         console.log('✅ Redis WebSocket Adapter initialized');
     } catch (error) {
         console.warn('⚠️ Redis WebSocket Adapter not available, using default adapter');
     }*/
    // 🔥 ثبت multipart با require و تنظیمات ساده
    const fastifyInstance = app.getHttpAdapter().getInstance();

    // استفاده از require برای دور زدن مشکلات تایپ
    await fastifyInstance.register(require('@fastify/multipart'), {
        limits: {
            fileSize: 10 * 1024 * 1024, // 10MB
        }
        // ❌ attachFieldsToBody را حذف کنید
    });

    // Global pipes - غیرفعال کردن transform برای تست
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: false,
            forbidNonWhitelisted: true,
            transform: true, // ✅ این را true کنید
            disableErrorMessages: false, // ✅ خطاهای دقیق‌تر نشان داده شود
            exceptionFactory: (errors) => {
                // 🔥 این لاگ خطاهای validation را نشان می‌دهد
                console.log('🔍 Validation errors:', JSON.stringify(errors, null, 2));
                return new BadRequestException(errors);
            }
        }),
    );

    // بقیه کدها بدون تغییر...
    app.useGlobalFilters(new HttpExceptionFilter())
    app.useGlobalInterceptors(new LoggingInterceptor())

    // در main.ts - جایگزین enableCors فعلی
    // در main.ts - جایگزین کد CORS فعلی
    app.enableCors({
        origin: [
            'https://iton.vercel.app',
            'https://iton.com',
            'https://iton.ir',
            'http://localhost:3000',
            'http://localhost:5173',
            'http://localhost:3011',
            'http://169.254.14.254:3000'
        ],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With']
    });

    const config = new DocumentBuilder()
        .setTitle("Wholesale Marketplace API")
        .setDescription("Professional wholesale marketplace backend API")
        .setVersion("1.0")
        .addBearerAuth(
            { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
            'access-token',
        )
        .build()

    const document = SwaggerModule.createDocument(app, config)
    SwaggerModule.setup("api", app, document)

    const port = process.env.PORT || 3011
    await app.listen(port, "0.0.0.0")

    console.log(`🚀 Application is running on: http://localhost:${port}`)
    console.log(`📁 Fastify multipart enabled`)
}

bootstrap()