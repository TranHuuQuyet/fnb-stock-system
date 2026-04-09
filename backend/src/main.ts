import { ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true
  });

  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.use(compression());
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:3000'],
    credentials: true
  });
  app.getHttpAdapter().getInstance().set('trust proxy', process.env.TRUST_PROXY ?? '1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
  app.useGlobalGuards(
    new JwtAuthGuard(app.get(Reflector)),
    new RolesGuard(app.get(Reflector))
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('API quản lý tồn kho F&B')
    .setDescription('API kiểm soát sử dụng nguyên liệu theo lô')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(Number(process.env.PORT ?? 4000));
}

bootstrap();
