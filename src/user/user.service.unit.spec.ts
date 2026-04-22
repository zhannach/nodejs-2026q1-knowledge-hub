import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { DbService } from '../db/db.service';
import { AuthService } from '../auth/auth.service';
import { UserService } from './user.service';

vi.mock('bcrypt', () => ({
  compare: vi.fn(),
}));

const mockCompare = bcrypt.compare as unknown as Mock;

const USER_ID = '11111111-1111-4111-8111-111111111111';
const ACTOR_ID = '22222222-2222-4222-8222-222222222222';

describe('UserService', () => {
  let service: UserService;
  let db: {
    user: {
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
    };
  };
  let authService: {
    hashPassword: ReturnType<typeof vi.fn>;
  };

  const adminActor = { id: ACTOR_ID, login: 'admin', role: Role.ADMIN };
  const viewerActor = { id: ACTOR_ID, login: 'viewer', role: Role.VIEWER };
  const editorActor = { id: ACTOR_ID, login: 'editor', role: Role.EDITOR };

  beforeEach(async () => {
    db = {
      user: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
        findFirst: vi.fn(),
      },
    };
    authService = {
      hashPassword: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: DbService, useValue: db },
        { provide: AuthService, useValue: authService },
      ],
    }).compile();

    service = module.get(UserService);
  });

  it('returns sanitized paginated users', async () => {
    db.user.findMany.mockResolvedValue([
      {
        id: USER_ID,
        login: 'zoe',
        password: 'hashed',
        role: Role.VIEWER,
        createdAt: new Date('2024-01-02T00:00:00.000Z'),
        updatedAt: new Date('2024-01-02T00:00:00.000Z'),
        articles: [],
        comments: [],
      },
      {
        id: ACTOR_ID,
        login: 'anna',
        password: 'hashed',
        role: Role.ADMIN,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-01T00:00:00.000Z'),
        articles: [],
        comments: [],
      },
    ]);

    const result = await service.getAll({
      sortBy: 'login',
      page: '1',
      limit: '1',
    });

    expect(result).toEqual({
      data: [
        expect.objectContaining({
          id: ACTOR_ID,
          login: 'anna',
          role: 'admin',
        }),
      ],
      total: 2,
      page: 1,
      limit: 1,
    });
  });

  it('throws for malformed user UUIDs', async () => {
    await expect(service.getById('bad-id')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('throws when user is not found', async () => {
    db.user.findUnique.mockResolvedValue(null);

    await expect(service.getById(USER_ID)).rejects.toThrow(NotFoundException);
  });

  it('forbids non-admins from creating users', async () => {
    db.user.count.mockResolvedValue(1);

    await expect(
      service.create({ login: 'alice', password: 'secret' }, viewerActor),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws on duplicate user login', async () => {
    db.user.findUnique.mockResolvedValue({ id: USER_ID, login: 'alice' });

    await expect(
      service.create({ login: 'alice', password: 'secret' }, adminActor),
    ).rejects.toThrow(BadRequestException);
  });

  it('hashes passwords and assigns a default role when admins create users', async () => {
    db.user.findUnique.mockResolvedValue(null);
    authService.hashPassword.mockResolvedValue('hashed-password');
    db.user.create.mockResolvedValue({
      id: USER_ID,
      login: 'alice',
      password: 'hashed-password',
      role: Role.VIEWER,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    });

    const result = await service.create(
      { login: 'alice', password: 'secret' },
      adminActor,
    );

    expect(authService.hashPassword).toHaveBeenCalledWith('secret');
    expect(result).not.toHaveProperty('password');
    expect(result.role).toBe('viewer');
  });

  it('rejects empty update payloads', async () => {
    await expect(service.update(USER_ID, {}, adminActor)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('blocks non-admins from changing another user', async () => {
    db.user.findUnique.mockResolvedValue({
      id: USER_ID,
      password: 'hashed',
      role: Role.VIEWER,
    });
    db.user.count.mockResolvedValue(1);

    await expect(
      service.update(USER_ID, { newPassword: 'secret' }, editorActor),
    ).rejects.toThrow(ForbiddenException);
  });

  it('blocks non-admins from changing roles', async () => {
    db.user.findUnique.mockResolvedValue({
      id: ACTOR_ID,
      password: 'hashed',
      role: Role.VIEWER,
    });
    db.user.count.mockResolvedValue(1);

    await expect(
      service.update(ACTOR_ID, { role: Role.ADMIN }, viewerActor),
    ).rejects.toThrow(ForbiddenException);
  });

  it('requires newPassword when password update is attempted', async () => {
    db.user.findUnique.mockResolvedValue({
      id: ACTOR_ID,
      password: 'hashed',
      role: Role.VIEWER,
    });
    db.user.count.mockResolvedValue(1);

    await expect(
      service.update(ACTOR_ID, { oldPassword: 'old-secret' }, viewerActor),
    ).rejects.toThrow('newPassword is required');
  });

  it('requires oldPassword for non-admin self password changes', async () => {
    db.user.findUnique.mockResolvedValue({
      id: ACTOR_ID,
      password: 'hashed',
      role: Role.VIEWER,
    });
    db.user.count.mockResolvedValue(1);

    await expect(
      service.update(ACTOR_ID, { newPassword: 'new-secret' }, viewerActor),
    ).rejects.toThrow('oldPassword is required');
  });

  it('throws when old password is wrong', async () => {
    db.user.findUnique.mockResolvedValue({
      id: ACTOR_ID,
      password: 'hashed',
      role: Role.VIEWER,
    });
    db.user.count.mockResolvedValue(1);
    mockCompare.mockResolvedValue(false);

    await expect(
      service.update(
        ACTOR_ID,
        { oldPassword: 'wrong', newPassword: 'new-secret' },
        viewerActor,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('hashes new password for valid self-service updates', async () => {
    db.user.findUnique.mockResolvedValue({
      id: ACTOR_ID,
      password: 'hashed',
      role: Role.VIEWER,
    });
    db.user.count.mockResolvedValue(1);
    mockCompare.mockResolvedValue(true);
    authService.hashPassword.mockResolvedValue('new-hash');
    db.user.update.mockResolvedValue({
      id: ACTOR_ID,
      login: 'viewer',
      password: 'new-hash',
      role: Role.VIEWER,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-02T00:00:00.000Z'),
    });

    const result = await service.update(
      ACTOR_ID,
      { oldPassword: 'old', newPassword: 'new-secret' },
      viewerActor,
    );

    expect(authService.hashPassword).toHaveBeenCalledWith('new-secret');
    expect(result).not.toHaveProperty('password');
  });

  it('allows admins to update roles without oldPassword', async () => {
    db.user.findUnique.mockResolvedValue({
      id: USER_ID,
      password: 'hashed',
      role: Role.VIEWER,
    });
    db.user.update.mockResolvedValue({
      id: USER_ID,
      login: 'alice',
      password: 'hashed',
      role: Role.EDITOR,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    });

    const result = await service.update(
      USER_ID,
      { role: Role.EDITOR },
      adminActor,
    );

    expect(result.role).toBe('editor');
  });

  it('blocks non-admins from deleting other users', async () => {
    db.user.count.mockResolvedValue(1);

    await expect(service.remove(USER_ID, viewerActor)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('throws when deleting a missing user', async () => {
    db.user.findUnique.mockResolvedValue(null);

    await expect(service.remove(USER_ID, adminActor)).rejects.toThrow(
      NotFoundException,
    );
  });
});
