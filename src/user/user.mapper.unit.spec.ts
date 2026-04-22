import { Role } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { sanitizeUser } from './user.mapper';

describe('sanitizeUser', () => {
  it('removes password and normalizes role/date fields', () => {
    const result = sanitizeUser({
      id: '1',
      login: 'alice',
      password: 'hashed',
      role: Role.ADMIN,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-02T00:00:00.000Z'),
    } as any);

    expect(result).toEqual({
      id: '1',
      login: 'alice',
      role: 'admin',
      createdAt: 1704067200000,
      updatedAt: 1704153600000,
    });
  });
});
