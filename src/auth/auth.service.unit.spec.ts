import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { DbService } from '../db/db.service';
import { AuthService } from './auth.service';
import { RefreshTokenBlacklistService } from './refresh-token-blacklist.service';
import {
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
} from '../common/errors';

vi.mock('bcrypt', () => ({
  compare: vi.fn(),
  hash: vi.fn(),
}));

const mockHash = bcrypt.hash as unknown as Mock;
const mockCompare = bcrypt.compare as unknown as Mock;

const USER_ID = '11111111-1111-4111-8111-111111111111';

describe('AuthService', () => {
  let service: AuthService;
  let db: {
    user: {
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
  };
  let jwtService: {
    signAsync: ReturnType<typeof vi.fn>;
    verifyAsync: ReturnType<typeof vi.fn>;
  };
  let refreshTokenBlacklist: {
    has: ReturnType<typeof vi.fn>;
    blacklist: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    process.env.JWT_SECRET = 'access-secret';
    process.env.JWT_ACCESS_TTL = '15m';
    process.env.JWT_REFRESH_SECRET = 'refresh-secret';
    process.env.JWT_REFRESH_TTL = '7d';
    process.env.PASSWORD_SALT_ROUNDS = '10';
    delete process.env.TEST_MODE;

    db = {
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
    };
    jwtService = {
      signAsync: vi.fn(),
      verifyAsync: vi.fn(),
    };
    refreshTokenBlacklist = {
      has: vi.fn(),
      blacklist: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: DbService, useValue: db },
        { provide: JwtService, useValue: jwtService },
        {
          provide: RefreshTokenBlacklistService,
          useValue: refreshTokenBlacklist,
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('throws on duplicate signup login', async () => {
    db.user.findUnique.mockResolvedValue({ id: USER_ID, login: 'alice' });

    await expect(
      service.signup({ login: 'alice', password: 'secret' }),
    ).rejects.toThrow(ValidationError);
  });

  it('hashes password and assigns viewer role on signup', async () => {
    db.user.findUnique.mockResolvedValue(null);
    mockHash.mockResolvedValue('hashed-password');
    db.user.create.mockResolvedValue({
      id: USER_ID,
      login: 'alice',
      password: 'hashed-password',
      role: Role.VIEWER,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    });

    const result = await service.signup({ login: 'alice', password: 'secret' });

    expect(db.user.create).toHaveBeenCalledWith({
      data: {
        login: 'alice',
        password: 'hashed-password',
        role: Role.VIEWER,
      },
    });
    expect(result).toEqual(
      expect.objectContaining({
        id: USER_ID,
        login: 'alice',
        role: 'viewer',
      }),
    );
    expect(result).not.toHaveProperty('password');
  });

  it('assigns admin role for the bootstrap auth signup login in test mode', async () => {
    process.env.TEST_MODE = 'auth';
    db.user.findUnique.mockResolvedValue(null);
    mockHash.mockResolvedValue('hashed-password');
    db.user.create.mockResolvedValue({
      id: USER_ID,
      login: 'TEST_AUTH_LOGIN',
      password: 'hashed-password',
      role: Role.ADMIN,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    });

    const result = await service.signup({
      login: 'TEST_AUTH_LOGIN',
      password: 'secret',
    });

    expect(db.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ role: Role.ADMIN }),
    });
    expect(result.role).toBe('admin');
  });

  it('throws when login user does not exist', async () => {
    db.user.findUnique.mockResolvedValue(null);

    await expect(
      service.login({ login: 'alice', password: 'secret' }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('throws when login password does not match', async () => {
    db.user.findUnique.mockResolvedValue({
      id: USER_ID,
      login: 'alice',
      password: 'hashed-password',
      role: Role.VIEWER,
    });
    mockCompare.mockResolvedValue(false);

    await expect(
      service.login({ login: 'alice', password: 'secret' }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('generates access and refresh tokens on login', async () => {
    db.user.findUnique.mockResolvedValue({
      id: USER_ID,
      login: 'alice',
      password: 'hashed-password',
      role: Role.ADMIN,
    });
    mockCompare.mockResolvedValue(true);
    jwtService.signAsync.mockResolvedValueOnce('access-token');
    jwtService.signAsync.mockResolvedValueOnce('refresh-token');

    const result = await service.login({
      login: 'alice',
      password: 'secret',
    });

    expect(jwtService.signAsync).toHaveBeenNthCalledWith(
      1,
      { userId: USER_ID, login: 'alice', role: 'admin' },
      { secret: 'access-secret', expiresIn: '15m' },
    );
    expect(jwtService.signAsync).toHaveBeenNthCalledWith(
      2,
      { userId: USER_ID, login: 'alice', role: 'admin' },
      { secret: 'refresh-secret', expiresIn: '7d' },
    );
    expect(result).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
  });

  it('verifies a valid access token', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      userId: USER_ID,
      login: 'alice',
      role: Role.ADMIN,
    });
    db.user.findUnique.mockResolvedValue({
      id: USER_ID,
      login: 'alice',
      role: Role.ADMIN,
    });

    const result = await service.validateAccessToken('valid-token');

    expect(result).toEqual({
      id: USER_ID,
      login: 'alice',
      role: Role.ADMIN,
    });
  });

  it('throws unauthorized for expired or malformed access tokens', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));

    await expect(service.validateAccessToken('expired-token')).rejects.toThrow(
      UnauthorizedError,
    );
  });

  it('throws unauthorized when access token user no longer exists', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      userId: USER_ID,
      login: 'alice',
      role: Role.ADMIN,
    });
    db.user.findUnique.mockResolvedValue(null);

    await expect(service.validateAccessToken('valid-token')).rejects.toThrow(
      UnauthorizedError,
    );
  });

  it('throws when refresh token is missing', async () => {
    await expect(service.refresh({})).rejects.toThrow(UnauthorizedError);
  });

  it('throws when refresh token is tampered', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('bad token'));

    await expect(
      service.refresh({ refreshToken: 'tampered-token' }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('throws when refresh token is blacklisted', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      userId: USER_ID,
      login: 'alice',
      role: Role.ADMIN,
      exp: 9999999999,
    });
    refreshTokenBlacklist.has.mockReturnValue(true);

    await expect(
      service.refresh({ refreshToken: 'blacklisted-token' }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('rotates tokens for a valid refresh token', async () => {
    jwtService.verifyAsync.mockResolvedValueOnce({
      userId: USER_ID,
      login: 'alice',
      role: Role.ADMIN,
      exp: 9999999999,
    });
    refreshTokenBlacklist.has.mockReturnValue(false);
    db.user.findUnique.mockResolvedValue({
      id: USER_ID,
      login: 'alice',
      role: Role.ADMIN,
    });
    jwtService.signAsync.mockResolvedValueOnce('new-access-token');
    jwtService.signAsync.mockResolvedValueOnce('new-refresh-token');

    const result = await service.refresh({ refreshToken: 'refresh-token' });

    expect(result).toEqual({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    });
  });

  it('throws when refresh token payload has no exp', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      userId: USER_ID,
      login: 'alice',
      role: Role.ADMIN,
    });

    await expect(
      service.refresh({ refreshToken: 'refresh-token' }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('blacklists refresh token on logout', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      userId: USER_ID,
      login: 'alice',
      role: Role.ADMIN,
      exp: 12345,
    });
    refreshTokenBlacklist.has.mockReturnValue(false);

    const result = await service.logout({ refreshToken: 'refresh-token' });

    expect(refreshTokenBlacklist.blacklist).toHaveBeenCalledWith(
      'refresh-token',
      12345000,
    );
    expect(result).toEqual({ message: 'Logged out successfully' });
  });
});
