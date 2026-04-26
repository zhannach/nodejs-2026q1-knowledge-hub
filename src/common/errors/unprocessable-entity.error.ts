import { HttpStatus } from '@nestjs/common';
import { AppError } from './app-error';

export class UnprocessableEntityError extends AppError {
  constructor(message = 'Unprocessable Entity') {
    super(HttpStatus.UNPROCESSABLE_ENTITY, message);
  }
}
