import { Role } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { hasAdminPrivileges } from './bootstrap-admin';

describe('hasAdminPrivileges', () => {
  it('returns true for real admins immediately', async () => {
    const db = {
      user: {
        count: vi.fn(),
        findFirst: vi.fn(),
      },
    } as any;

    await expect(
      hasAdminPrivileges(db, { id: '1', login: 'alice', role: Role.ADMIN }),
    ).resolves.toBe(true);
    expect(db.user.count).not.toHaveBeenCalled();
  });

  it('returns false for non-admins when an admin exists', async () => {
    const db = {
      user: {
        count: vi.fn().mockResolvedValue(1),
        findFirst: vi.fn(),
      },
    } as any;

    await expect(
      hasAdminPrivileges(db, { id: '1', login: 'alice', role: Role.EDITOR }),
    ).resolves.toBe(false);
  });

  it('treats the first user as bootstrap admin when no admins exist', async () => {
    const db = {
      user: {
        count: vi.fn().mockResolvedValue(0),
        findFirst: vi.fn().mockResolvedValue({ id: '1' }),
      },
    } as any;

    await expect(
      hasAdminPrivileges(db, { id: '1', login: 'alice', role: Role.EDITOR }),
    ).resolves.toBe(true);
  });
});
