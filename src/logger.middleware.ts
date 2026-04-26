import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AppLogger } from './common/logging/app-logger.service';
import { sanitizeForLogging } from './common/logging/sanitize-log-data';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  constructor(private readonly logger: AppLogger) {}

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, query, body } = req;
    const startedAt = Date.now();

    this.logger.writeLog(
      'log',
      'Incoming request',
      {
        method,
        url: originalUrl,
        query: sanitizeForLogging(query),
        body: sanitizeForLogging(body),
      },
      'HTTP',
    );

    res.on('finish', () => {
      this.logger.writeLog(
        'log',
        'Outgoing response',
        {
          method,
          url: originalUrl,
          statusCode: res.statusCode,
          responseTimeMs: Date.now() - startedAt,
        },
        'HTTP',
      );
    });

    next();
  }
}
