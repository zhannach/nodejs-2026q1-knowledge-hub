import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthenticatedRequest } from './auth.types';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (this.isPublicPath(request.path)) {
      return true;
    }

    const authorization = request.headers.authorization;
    if (!authorization) {
      throw new UnauthorizedException('Authorization header is required');
    }

    const [scheme, token] = authorization.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Authorization header must use Bearer');
    }

    request.user = await this.authService.validateAccessToken(token);
    return true;
  }

  private isPublicPath(path: string) {
    return (
      path === '/' ||
      path.startsWith('/doc') ||
      path === '/auth/signup' ||
      path === '/auth/login' ||
      path === '/auth/refresh'
    );
  }
}
