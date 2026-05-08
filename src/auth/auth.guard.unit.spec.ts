import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';

function createExecutionContext(request: Record<string, any>) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as any;
}

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let authService: {
    validateAccessToken: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    authService = {
      validateAccessToken: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthGuard, { provide: AuthService, useValue: authService }],
    }).compile();

    guard = module.get(AuthGuard);
  });

  it('allows public paths without a token', async () => {
    const request = { path: '/auth/login', headers: {} };

    await expect(
      guard.canActivate(createExecutionContext(request)),
    ).resolves.toBe(true);
  });

  it('allows requests with a valid bearer token', async () => {
    const request: any = {
      path: '/user',
      headers: { authorization: 'Bearer valid-token' },
    };
    authService.validateAccessToken.mockResolvedValue({
      id: '1',
      login: 'alice',
      role: Role.ADMIN,
    });

    const result = await guard.canActivate(createExecutionContext(request));

    expect(result).toBe(true);
    expect(request.user).toEqual({
      id: '1',
      login: 'alice',
      role: Role.ADMIN,
    });
  });

  it('throws when authorization header is missing', async () => {
    await expect(
      guard.canActivate(createExecutionContext({ path: '/user', headers: {} })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws when authorization header is malformed', async () => {
    await expect(
      guard.canActivate(
        createExecutionContext({
          path: '/user',
          headers: { authorization: 'Token abc' },
        }),
      ),
    ).rejects.toThrow('Authorization header must use Bearer');
  });

  it('propagates expired token failures', async () => {
    authService.validateAccessToken.mockRejectedValue(
      new UnauthorizedException('Invalid or expired access token'),
    );

    await expect(
      guard.canActivate(
        createExecutionContext({
          path: '/user',
          headers: { authorization: 'Bearer expired-token' },
        }),
      ),
    ).rejects.toThrow(UnauthorizedException);
  });
});
