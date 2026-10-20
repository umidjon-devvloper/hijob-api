import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import * as path from 'path';
import { AppModule } from './app.module';
import { StorageService } from './storage/storage.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  app.setGlobalPrefix('api/v1', { exclude: ['/uploads/(.*)'] });

  // Serve uploaded files publicly (they're already namespaced by seller id + uuid).
  // Helmet's cross-origin resource policy would block cross-origin <img> loads
  // from the seller portal and mobile app; we disable that one policy.
  app.use(helmet({ crossOriginResourcePolicy: false }));

  // Local-mode only: serve /uploads/* from disk. In R2 mode files are hosted
  // on the CDN so we skip this and never touch the filesystem.
  const storage = app.get(StorageService);
  if (storage.servesStatic) {
    // Static files bypass Nest's CORS middleware; add permissive headers
    // on /uploads/* so <img> and fetch() from any origin can read them.
    app.use('/uploads', (_req: any, res: any, next: any) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      next();
    });
    app.useStaticAssets(storage.getRoot(), { prefix: '/uploads/' });
  }

  app.enableCors({
    origin:
      process.env.CORS_ORIGIN?.split(',') ??
      ['http://localhost:3001', 'http://localhost:19006', /^http:\/\/localhost:\d+$/],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('N24:31 API')
      .setDescription('Modest fashion virtual try-on marketplace')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = Number(process.env.API_PORT ?? 4000);
  const host = process.env.API_HOST ?? '0.0.0.0';
  await app.listen(port, host);

  const logger = new Logger('Bootstrap');
  logger.log(`🚀 N24:31 API → http://${host}:${port}/api/v1`);
  logger.log(`📚 Swagger    → http://${host}:${port}/api/docs`);
}

bootstrap();
