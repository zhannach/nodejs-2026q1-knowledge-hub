import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as dotenv from 'dotenv';
import { AppLogger } from './common/logging/app-logger.service';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { DbService } from './db/db.service';
dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  const logger = app.get(AppLogger);
  const globalExceptionFilter = app.get(GlobalExceptionFilter);
  const db = app.get(DbService);

  app.useLogger(logger);
  app.useGlobalFilters(globalExceptionFilter);
  app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Knowledge Hub API')
    .setDescription('The Knowledge Hub API description')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('doc', app, document);

  const port = process.env.PORT || 4000;
  let isShuttingDown = false;

  const shutdown = async (
    reason: 'uncaughtException' | 'unhandledRejection',
    error: unknown,
  ) => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;

    const normalizedError =
      error instanceof Error ? error : new Error(String(error));
    const trace = normalizedError.stack ?? normalizedError.message;

    if (reason === 'uncaughtException') {
      logger.fatal(
        'Process crashed with an uncaught exception',
        { reason, message: normalizedError.message },
        'Process',
        trace,
      );
    } else {
      logger.writeLog(
        'error',
        'Unhandled promise rejection detected',
        { reason, message: normalizedError.message },
        'Process',
        trace,
      );
    }

    try {
      await app.close();
      await db.$disconnect();
    } finally {
      process.exit(1);
    }
  };

  process.on('uncaughtException', (error) => {
    void shutdown('uncaughtException', error);
  });

  process.on('unhandledRejection', (reason) => {
    void shutdown('unhandledRejection', reason);
  });

  await app.listen(port);

  logger.writeLog(
    'log',
    'Application started',
    {
      port: Number(port),
      url: `http://localhost:${port}`,
      docsUrl: `http://localhost:${port}/doc`,
    },
    'Bootstrap',
  );
}
bootstrap();
