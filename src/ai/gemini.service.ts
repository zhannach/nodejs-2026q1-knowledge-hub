import {
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AppLogger } from '../common/logging/app-logger.service';

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  usageMetadata?: {
    totalTokenCount?: number;
  };
}

interface GeminiEmbeddingResponse {
  embedding?: {
    values?: number[];
  };
}

interface GeminiErrorResponse {
  error?: {
    code?: number;
    message?: string;
    status?: string;
    details?: Array<{
      '@type'?: string;
      violations?: Array<{
        quotaMetric?: string;
        quotaId?: string;
        quotaDimensions?: Record<string, string>;
        quotaValue?: string;
      }>;
      retryDelay?: string;
    }>;
  };
}

interface SanitizedGeminiError {
  status?: string;
  message?: string;
  quotaMetric?: string;
  quotaId?: string;
  quotaValue?: string;
  model?: string;
  retryAfterSeconds?: number;
}

export interface GeminiGeneration {
  text: string;
  totalTokens?: number;
}

@Injectable()
export class GeminiService {
  private readonly maxRetries = this.getPositiveNumber(
    process.env.GEMINI_MAX_RETRIES,
    1,
  );
  private readonly timeoutMs = this.getPositiveNumber(
    process.env.GEMINI_TIMEOUT_MS,
    30000,
  );
  private lastCallTimestamp = 0;
  private requestQueue = Promise.resolve();
  private readonly minIntervalMs = this.getPositiveNumber(
    process.env.GEMINI_MIN_INTERVAL_MS,
    4500,
  );

  constructor(private readonly logger: AppLogger) {}

  async generateText(prompt: string): Promise<GeminiGeneration> {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new ServiceUnavailableException('Gemini API is not configured');
    }

    const url = this.buildUrl();
    let attempt = 0;

    while (attempt <= this.maxRetries) {
      try {
        await this.throttle();

        this.logger.writeLog('log', 'Calling Gemini', { attempt }, 'Gemini');

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }],
              },
            ],
          }),
          signal: AbortSignal.timeout(this.timeoutMs),
        });

        if (response.status === HttpStatus.TOO_MANY_REQUESTS) {
          const geminiError = await this.readGeminiError(response);

          throw new ServiceUnavailableException(
            this.buildRateLimitMessage(geminiError),
          );
        }

        if (
          response.status === HttpStatus.UNAUTHORIZED ||
          response.status === HttpStatus.FORBIDDEN
        ) {
          throw new InternalServerErrorException(
            'Gemini authentication failed. Check server configuration.',
          );
        }

        if (!response.ok) {
          const geminiError = await this.readGeminiError(response);

          this.logger.writeLog(
            'error',
            'Gemini upstream request failed',
            {
              statusCode: response.status,
              upstreamStatus: geminiError.status,
              quotaId: geminiError.quotaId,
              quotaMetric: geminiError.quotaMetric,
              model: geminiError.model,
            },
            'Gemini',
          );

          throw new ServiceUnavailableException(
            'Gemini service is temporarily unavailable',
          );
        }

        const payload = (await response.json()) as GeminiResponse;
        const text = this.extractText(payload);

        return {
          text,
          totalTokens: payload.usageMetadata?.totalTokenCount,
        };
      } catch (error) {
        if (
          error instanceof InternalServerErrorException ||
          error instanceof ServiceUnavailableException
        ) {
          throw error;
        }

        if (attempt < this.maxRetries && this.isRetryableError(error)) {
          await this.backoff(attempt);
          attempt++;
          continue;
        }

        this.logger.writeLog(
          'error',
          'Gemini request failed',
          { error: error instanceof Error ? error.name : String(error) },
          'Gemini',
          error instanceof Error ? error.stack : undefined,
        );

        throw new ServiceUnavailableException(
          'Gemini service is temporarily unavailable',
        );
      }
    }

    throw new ServiceUnavailableException(
      'Gemini service is temporarily unavailable',
    );
  }

  async embedText(text: string): Promise<number[]> {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new ServiceUnavailableException('Gemini API is not configured');
    }

    const url = this.buildEmbeddingUrl();
    let attempt = 0;

    while (attempt <= this.maxRetries) {
      try {
        await this.throttle();

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            model: `models/${this.getEmbeddingModel()}`,
            content: {
              parts: [{ text }],
            },
          }),
          signal: AbortSignal.timeout(this.timeoutMs),
        });

        if (response.status === HttpStatus.TOO_MANY_REQUESTS) {
          const geminiError = await this.readGeminiError(response);

          throw new ServiceUnavailableException(
            this.buildRateLimitMessage(geminiError),
          );
        }

        if (
          response.status === HttpStatus.UNAUTHORIZED ||
          response.status === HttpStatus.FORBIDDEN
        ) {
          throw new InternalServerErrorException(
            'Gemini authentication failed. Check server configuration.',
          );
        }

        if (!response.ok) {
          const geminiError = await this.readGeminiError(response);

          this.logger.writeLog(
            'error',
            'Gemini embedding request failed',
            {
              statusCode: response.status,
              upstreamStatus: geminiError.status,
              quotaId: geminiError.quotaId,
              quotaMetric: geminiError.quotaMetric,
              model: geminiError.model,
            },
            'Gemini',
          );

          throw new ServiceUnavailableException(
            'Gemini service is temporarily unavailable',
          );
        }

        const payload = (await response.json()) as GeminiEmbeddingResponse;
        const embedding = payload.embedding?.values;

        if (!embedding?.length) {
          throw new ServiceUnavailableException(
            'Gemini returned an empty embedding',
          );
        }

        return embedding;
      } catch (error) {
        if (
          error instanceof InternalServerErrorException ||
          error instanceof ServiceUnavailableException
        ) {
          throw error;
        }

        if (attempt < this.maxRetries && this.isRetryableError(error)) {
          await this.backoff(attempt);
          attempt++;
          continue;
        }

        this.logger.writeLog(
          'error',
          'Gemini embedding request failed',
          { error: error instanceof Error ? error.name : String(error) },
          'Gemini',
          error instanceof Error ? error.stack : undefined,
        );

        throw new ServiceUnavailableException(
          'Gemini service is temporarily unavailable',
        );
      }
    }

    throw new ServiceUnavailableException(
      'Gemini service is temporarily unavailable',
    );
  }

  private async throttle() {
    const previous = this.requestQueue;
    let releaseQueue: () => void;
    this.requestQueue = new Promise<void>((resolve) => {
      releaseQueue = resolve;
    });

    await previous;

    try {
      const now = Date.now();
      const diff = now - this.lastCallTimestamp;

      if (diff < this.minIntervalMs) {
        await new Promise((resolve) =>
          setTimeout(resolve, this.minIntervalMs - diff),
        );
      }

      this.lastCallTimestamp = Date.now();
    } finally {
      releaseQueue!();
    }
  }

  private buildUrl() {
    const baseUrl =
      process.env.GEMINI_API_BASE_URL ??
      'https://generativelanguage.googleapis.com';
    const model = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';
    return `${baseUrl.replace(/\/$/, '')}/v1beta/models/${model}:generateContent`;
  }

  private buildEmbeddingUrl() {
    const baseUrl =
      process.env.GEMINI_API_BASE_URL ??
      'https://generativelanguage.googleapis.com';
    return `${baseUrl.replace(/\/$/, '')}/v1beta/models/${this.getEmbeddingModel()}:embedContent`;
  }

  private getEmbeddingModel() {
    return process.env.GEMINI_EMBEDDING_MODEL ?? 'text-embedding-004';
  }

  private extractText(payload: GeminiResponse) {
    const text = payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('')
      .trim();

    if (!text) {
      throw new ServiceUnavailableException(
        'Gemini returned an empty response',
      );
    }

    return text;
  }

  private async readGeminiError(
    response: Response,
  ): Promise<SanitizedGeminiError> {
    let payload: GeminiErrorResponse | undefined;

    try {
      payload = (await response.json()) as GeminiErrorResponse;
    } catch {
      payload = undefined;
    }

    const quotaFailure = payload?.error?.details?.find((detail) =>
      detail['@type']?.includes('QuotaFailure'),
    );
    const retryInfo = payload?.error?.details?.find((detail) =>
      detail['@type']?.includes('RetryInfo'),
    );
    const violation = quotaFailure?.violations?.[0];

    return {
      status: payload?.error?.status,
      message: payload?.error?.message,
      quotaMetric: violation?.quotaMetric,
      quotaId: violation?.quotaId,
      quotaValue: violation?.quotaValue,
      model: violation?.quotaDimensions?.model,
      retryAfterSeconds: this.parseRetryDelay(retryInfo?.retryDelay),
    };
  }

  private buildRateLimitMessage(error: SanitizedGeminiError) {
    const details = [
      error.status,
      error.quotaId ? `quota=${error.quotaId}` : undefined,
      error.quotaMetric ? `metric=${error.quotaMetric}` : undefined,
      error.model ? `model=${error.model}` : undefined,
      error.retryAfterSeconds
        ? `retryAfter=${error.retryAfterSeconds}s`
        : undefined,
    ].filter(Boolean);

    return [
      'Gemini upstream rate limit exceeded.',
      details.length ? `Details: ${details.join(', ')}.` : undefined,
    ]
      .filter(Boolean)
      .join(' ');
  }

  private parseRetryDelay(retryDelay?: string) {
    if (!retryDelay) {
      return undefined;
    }

    const seconds = Number(retryDelay.replace(/s$/, ''));
    return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
  }

  private getPositiveNumber(value: string | undefined, fallback: number) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  private isRetryableError(error: unknown) {
    return (
      error instanceof TypeError ||
      (error instanceof Error && error.name === 'TimeoutError')
    );
  }

  private backoff(attempt: number, retryAfterSeconds?: number) {
    const delayMs = retryAfterSeconds
      ? retryAfterSeconds * 1000
      : 300 * 2 ** attempt;

    return new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}
