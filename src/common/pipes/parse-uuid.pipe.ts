import { Injectable, PipeTransform } from '@nestjs/common';
import { validate as isUuid } from 'uuid';
import { ValidationError } from '../errors';

@Injectable()
export class ParseUuidPipe implements PipeTransform<string, string> {
  transform(value: string) {
    if (!isUuid(value)) {
      throw new ValidationError('Invalid UUID');
    }

    return value;
  }
}
