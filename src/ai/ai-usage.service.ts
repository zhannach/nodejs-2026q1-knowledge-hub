import { Injectable } from '@nestjs/common';

export interface UsageSnapshot {
  totalRequests: number;
  requestsByEndpoint: Record<string, number>;
  totalTokens?: number;
}

@Injectable()
export class AiUsageService {
  private totalRequests = 0;
  private totalTokens = 0;
  private readonly requestsByEndpoint = new Map<string, number>();

  record(endpoint: string, totalTokens?: number) {
    this.totalRequests += 1;
    this.requestsByEndpoint.set(
      endpoint,
      (this.requestsByEndpoint.get(endpoint) ?? 0) + 1,
    );

    if (typeof totalTokens === 'number') {
      this.totalTokens += totalTokens;
    }
  }

  addTokens(totalTokens?: number) {
    if (typeof totalTokens === 'number') {
      this.totalTokens += totalTokens;
    }
  }

  getSnapshot(): UsageSnapshot {
    return {
      totalRequests: this.totalRequests,
      requestsByEndpoint: Object.fromEntries(this.requestsByEndpoint),
      totalTokens: this.totalTokens || undefined,
    };
  }
}
