import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupApp, setupSwagger } from './common/config/app-setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Prefix /api, helmet, CORS, ValidationPipe({ whitelist, forbidNonWhitelisted, transform })
  setupApp(app);
  // Swagger UI: /api/docs — OpenAPI JSON: /api/docs-json
  setupSwagger(app);

  const port = app.get(ConfigService).get<number>('PORT') ?? 3001;
  await app.listen(port);
  Logger.log(`API: http://localhost:${port}/api — Swagger: http://localhost:${port}/api/docs`, 'Bootstrap');
}
void bootstrap();
