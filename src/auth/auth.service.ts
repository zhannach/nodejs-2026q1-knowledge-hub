import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DbService } from '../db/db.service';
import { AuthCredentialsDto } from './dto/auth-credentials.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { getPasswordSaltRounds } from './auth.config';
import { AuthenticatedUser, TokenPayload } from './auth.types';
import { compare, hash } from 'bcrypt';
import { sanitizeUser } from '../user/user.mapper';
import { Role } from '@prisma/client';
import { RefreshTokenBlacklistService } from './refresh-token-blacklist.service';
import {
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
} from '../common/errors';

type VerifiedRefreshPayload = TokenPayload & { exp: number };

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DbService,
    private readonly jwtService: JwtService,
    private readonly refreshTokenBlacklist: RefreshTokenBlacklistService,
  ) {}

  async signup(dto: AuthCredentialsDto) {
    const existingUser = await this.db.user.findUnique({
      where: { login: dto.login },
    });

    if (existingUser) {
      throw new ValidationError('Login already taken');
    }

    const createdUser = await this.db.user.create({
      data: {
        login: dto.login,
        password: await this.hashPassword(dto.password),
        role: this.resolveSignupRole(dto.login),
      },
    });

    return sanitizeUser(createdUser);
  }

  async login(dto: AuthCredentialsDto) {
    const user = await this.db.user.findUnique({
      where: { login: dto.login },
    });

    if (!user) {
      throw new ForbiddenError('Invalid login or password');
    }

    const passwordMatches = await compare(dto.password, user.password);
    if (!passwordMatches) {
      throw new ForbiddenError('Invalid login or password');
    }

    return this.issueTokens({
      id: user.id,
      login: user.login,
      role: user.role.toLowerCase() as Role,
    });
  }

  async refresh(dto: RefreshTokenDto) {
    const { refreshToken, payload } = await this.verifyRefreshToken(dto);

    if (this.refreshTokenBlacklist.has(refreshToken)) {
      throw new ForbiddenError('Invalid or expired refresh token');
    }

    const user = await this.db.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      throw new ForbiddenError('Invalid or expired refresh token');
    }

    return this.issueTokens({
      id: user.id,
      login: user.login,
      role: user.role.toLowerCase() as Role,
    });
  }

  async validateAccessToken(token: string): Promise<AuthenticatedUser> {
    let payload: TokenPayload;

    try {
      payload = await this.jwtService.verifyAsync<TokenPayload>(token, {
        secret: process.env.JWT_SECRET,
      });
    } catch {
      throw new UnauthorizedError('Invalid or expired access token');
    }

    const user = await this.db.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid or expired access token');
    }

    return {
      id: user.id,
      login: user.login,
      role: user.role,
    };
  }

  async logout(dto: RefreshTokenDto) {
    const { refreshToken, payload } = await this.verifyRefreshToken(dto);

    if (this.refreshTokenBlacklist.has(refreshToken)) {
      throw new ForbiddenError('Invalid or expired refresh token');
    }

    this.refreshTokenBlacklist.blacklist(refreshToken, payload.exp * 1000);

    return { message: 'Logged out successfully' };
  }

  async hashPassword(password: string) {
    return hash(password, getPasswordSaltRounds());
  }

  private async issueTokens(user: AuthenticatedUser) {
    const payload: TokenPayload = {
      userId: user.id,
      login: user.login,
      role: user.role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_SECRET,
        expiresIn: process.env.JWT_ACCESS_TTL,
      }),
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: process.env.JWT_REFRESH_TTL,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async verifyRefreshToken(dto: RefreshTokenDto) {
    if (!dto.refreshToken) {
      throw new UnauthorizedError('Refresh token is required');
    }

    let payload: VerifiedRefreshPayload;

    try {
      payload = await this.jwtService.verifyAsync<VerifiedRefreshPayload>(
        dto.refreshToken,
        {
          secret: process.env.JWT_REFRESH_SECRET,
        },
      );
    } catch {
      throw new ForbiddenError('Invalid or expired refresh token');
    }

    if (typeof payload.exp !== 'number') {
      throw new ForbiddenError('Invalid or expired refresh token');
    }

    return {
      refreshToken: dto.refreshToken,
      payload,
    };
  }

  private resolveSignupRole(login: string) {
    if (process.env.TEST_MODE === 'auth' && login === 'TEST_AUTH_LOGIN') {
      return Role.ADMIN;
    }

    return Role.VIEWER;
  }
}
