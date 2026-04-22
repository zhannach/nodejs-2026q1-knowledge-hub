import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { ParseUuidPipe } from './parse-uuid.pipe';

describe('ParseUuidPipe', () => {
  const pipe = new ParseUuidPipe();

  it('passes through valid UUID values', () => {
    const uuid = '11111111-1111-4111-8111-111111111111';

    expect(pipe.transform(uuid)).toBe(uuid);
  });

  it('throws BadRequestException for invalid strings', () => {
    expect(() => pipe.transform('not-a-uuid')).toThrow(BadRequestException);
  });
});
