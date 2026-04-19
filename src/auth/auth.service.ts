import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DbService } from '../db/db.service';
import { AuthCredentialsDto } from './dto/auth-credentials.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { getPasswordSaltRounds } from './auth.config';
import { AuthenticatedUser, TokenPayload } from './auth.types';
import { compare, hash } from 'bcrypt';
import { sanitizeUser } from '../user/user.mapper';
import { Role } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DbService,
    private readonly jwtService: JwtService,
  ) {}

  async signup(dto: AuthCredentialsDto) {
    const existingUser = await this.db.user.findUnique({
      where: { login: dto.login },
    });

    if (existingUser) {
      throw new BadRequestException('Login already taken');
    }

    const createdUser = await this.db.user.create({
      data: {
        login: dto.login,
        password: await this.hashPassword(dto.password),
        role: Role.VIEWER,
      },
    });

    return sanitizeUser(createdUser);
  }

  async login(dto: AuthCredentialsDto) {
    const user = await this.db.user.findUnique({
      where: { login: dto.login },
    });

    if (!user) {
      throw new ForbiddenException('Invalid login or password');
    }

    const passwordMatches = await compare(dto.password, user.password);
    if (!passwordMatches) {
      throw new ForbiddenException('Invalid login or password');
    }

    return this.issueTokens({
      id: user.id,
      login: user.login,
      role: user.role.toLowerCase() as Role,
    });
  }

  async refresh(dto: RefreshTokenDto) {
    if (!dto.refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    let payload: TokenPayload;

    try {
      payload = await this.jwtService.verifyAsync<TokenPayload>(
        dto.refreshToken,
        {
          secret: process.env.JWT_REFRESH_SECRET,
        },
      );
    } catch {
      throw new ForbiddenException('Invalid or expired refresh token');
    }

    const user = await this.db.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      throw new ForbiddenException('Invalid or expired refresh token');
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
      throw new UnauthorizedException('Invalid or expired access token');
    }

    const user = await this.db.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    return {
      id: user.id,
      login: user.login,
      role: user.role.toLowerCase() as Role,
    };
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
}
