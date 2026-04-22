import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RefreshTokenBlacklistService } from './refresh-token-blacklist.service';

describe('RefreshTokenBlacklistService', () => {
  let service: RefreshTokenBlacklistService;

  beforeEach(() => {
    service = new RefreshTokenBlacklistService();
  });

  it('marks a token as blacklisted until it expires', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);

    service.blacklist('refresh-token', 2000);

    expect(service.has('refresh-token')).toBe(true);
  });

  it('cleans up expired blacklisted tokens', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    service.blacklist('refresh-token', 1500);

    vi.spyOn(Date, 'now').mockReturnValue(2000);

    expect(service.has('refresh-token')).toBe(false);
  });
});
