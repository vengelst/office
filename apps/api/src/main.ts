import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  const jwtSecret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production' && (!jwtSecret || jwtSecret === 'change-me-in-production')) {
    console.error('FATAL: JWT_SECRET muss in Produktion gesetzt sein!');
    process.exit(1);
  }

  app.setGlobalPrefix('api');

  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3900',
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  // ── Swagger / OpenAPI ────────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Office API')
      .setDescription('CRM, Projektverwaltung, Monteurverwaltung, Zeiterfassung')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.API_PORT
    ? Number(process.env.API_PORT)
    : process.env.PORT
      ? Number(process.env.PORT)
      : 3801;
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
