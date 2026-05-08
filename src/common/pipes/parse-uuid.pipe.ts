import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { validate as isUuid } from 'uuid';

@Injectable()
export class ParseUuidPipe implements PipeTransform<string, string> {
  transform(value: string) {
    if (!isUuid(value)) {
      throw new BadRequestException('Invalid UUID');
    }

    return value;
  }
}
