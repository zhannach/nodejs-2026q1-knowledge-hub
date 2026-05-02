import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

@Injectable()
export class AiRateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, RateLimitBucket>();

  canActivate(context: ExecutionContext) {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const now = Date.now();
    const key = this.getClientKey(request);
    const limit = this.getLimit();
    const bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + 60000 });
      return true;
    }

    if (bucket.count >= limit) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      response.setHeader('Retry-After', String(retryAfter));
      throw new HttpException(
        `AI rate limit exceeded. Retry after ${retryAfter} seconds.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    bucket.count += 1;
    return true;
  }

  private getClientKey(request: Request) {
    return request.ip || request.socket.remoteAddress || 'unknown';
  }

  private getLimit() {
    const limit = Number(process.env.AI_RATE_LIMIT_RPM);
    return Number.isFinite(limit) && limit > 0 ? limit : 20;
  }
}
