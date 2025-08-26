import { NestFactory } from "@nestjs/core"
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify"
import { ValidationPipe } from "@nestjs/common"
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger"
import { AppModule } from "./app.module"
import { HttpExceptionFilter } from "./common/filters/http-exception.filter"
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor"

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter({ logger: true }))

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

  // Global filters
  app.useGlobalFilters(new HttpExceptionFilter())

  // Global interceptors
  app.useGlobalInterceptors(new LoggingInterceptor())

  // CORS
  app.enableCors({
    origin: true,
    credentials: true,
  })

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle("Wholesale Marketplace API")
    .setDescription("Professional wholesale marketplace backend API")
    .setVersion("1.0")
    .addBearerAuth()
    .build()

  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup("api", app, document)

  const port = process.env.PORT || 3010
  await app.listen(port, "0.0.0.0")

  console.log(`🚀 Application is running on: http://localhost:${port}`)
  console.log(`📚 Swagger documentation: http://localhost:${port}/api`)
}

bootstrap()
