import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

@Injectable()
export class RefreshTokenBlacklistService {
  private readonly blacklistedTokens = new Map<string, number>();

  blacklist(token: string, expiresAtMs: number) {
    this.cleanupExpired();
    this.blacklistedTokens.set(this.hashToken(token), expiresAtMs);
  }

  has(token: string) {
    this.cleanupExpired();
    return this.blacklistedTokens.has(this.hashToken(token));
  }

  private cleanupExpired() {
    const now = Date.now();

    for (const [tokenHash, expiresAtMs] of this.blacklistedTokens.entries()) {
      if (expiresAtMs <= now) {
        this.blacklistedTokens.delete(tokenHash);
      }
    }
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
