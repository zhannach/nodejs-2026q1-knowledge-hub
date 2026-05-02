import { Injectable } from '@nestjs/common';

interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

@Injectable()
export class AiCacheService {
  private readonly cache = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlSeconds = this.getDefaultTtlSeconds()) {
    this.cache.set(key, {
      expiresAt: Date.now() + ttlSeconds * 1000,
      value,
    });
  }

  buildArticleKey(
    endpoint: string,
    articleId: string,
    updatedAt: number,
    params: Record<string, unknown>,
  ) {
    return JSON.stringify({ endpoint, articleId, updatedAt, params });
  }

  private getDefaultTtlSeconds() {
    const ttl = Number(process.env.AI_CACHE_TTL_SEC);
    return Number.isFinite(ttl) && ttl > 0 ? ttl : 300;
  }
}
