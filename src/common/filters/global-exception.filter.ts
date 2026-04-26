import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { STATUS_CODES } from 'http';
import { AppLogger } from '../logging/app-logger.service';
import { AppError } from '../errors';

@Injectable()
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLogger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();

    const normalizedError = this.normalizeException(exception);

    this.logger.writeLog(
      'error',
      'Unhandled exception during request processing',
      {
        method: request.method,
        path: request.originalUrl,
        statusCode: normalizedError.statusCode,
        error: normalizedError.responseBody.error,
        message: normalizedError.responseBody.message,
      },
      'Exceptions',
      normalizedError.trace,
    );

    response
      .status(normalizedError.statusCode)
      .json(normalizedError.responseBody);
  }

  private normalizeException(exception: unknown) {
    if (exception instanceof AppError) {
      return {
        statusCode: exception.statusCode,
        responseBody: {
          statusCode: exception.statusCode,
          error: STATUS_CODES[exception.statusCode] ?? exception.name,
          message: exception.message,
        },
        trace: exception.stack,
      };
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const response = exception.getResponse();
      const payload =
        typeof response === 'string'
          ? {
              statusCode,
              error: STATUS_CODES[statusCode] ?? exception.name,
              message: response,
            }
          : {
              statusCode,
              error:
                (response as Record<string, unknown>).error ??
                STATUS_CODES[statusCode] ??
                exception.name,
              message:
                (response as Record<string, unknown>).message ??
                exception.message,
            };

      return {
        statusCode,
        responseBody: payload,
        trace: exception.stack,
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      responseBody: {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
      },
      trace: exception instanceof Error ? exception.stack : String(exception),
    };
  }
}
