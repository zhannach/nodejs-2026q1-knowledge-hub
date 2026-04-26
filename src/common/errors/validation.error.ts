import { HttpStatus } from '@nestjs/common';
import { AppError } from './app-error';

export class ValidationError extends AppError {
  constructor(message = 'Bad Request') {
    super(HttpStatus.BAD_REQUEST, message);
  }
}
