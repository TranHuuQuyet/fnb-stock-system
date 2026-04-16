import { ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { BusinessNetworkGuard } from './common/guards/business-network.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';
import { readBooleanEnv, validateRuntimeSecurityConfig } from './common/utils/runtime-config';

async function bootstrap() {
  validateRuntimeSecurityConfig();

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
    new RolesGuard(app.get(Reflector)),
    app.get(PermissionsGuard),
    app.get(BusinessNetworkGuard)
  );

  const enableSwagger = readBooleanEnv(
    process.env.ENABLE_SWAGGER,
    process.env.NODE_ENV !== 'production'
  );

  if (enableSwagger) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('API quan ly ton kho F&B')
      .setDescription('API kiem soat su dung nguyen lieu theo lo')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(Number(process.env.PORT ?? 4000));
}

bootstrap();
