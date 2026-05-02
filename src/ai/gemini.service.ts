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
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

export interface GeminiGeneration {
  text: string;
  totalTokens?: number;
}

@Injectable()
export class GeminiService {
  private readonly maxRetries = 3;
  private readonly timeoutMs = 30000;

  constructor(private readonly logger: AppLogger) {}

  async generateText(prompt: string): Promise<GeminiGeneration> {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new InternalServerErrorException('Gemini API is not configured');
    }

    const url = this.buildUrl();
    let attempt = 0;

    while (attempt <= this.maxRetries) {
      try {
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
          if (attempt < this.maxRetries) {
            await this.backoff(attempt);
            attempt += 1;
            continue;
          }

          throw new ServiceUnavailableException(
            'Gemini rate limit exceeded. Please try again later.',
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
          attempt += 1;
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

  private buildUrl() {
    const baseUrl =
      process.env.GEMINI_API_BASE_URL ??
      'https://generativelanguage.googleapis.com';
    const model = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';
    return `${baseUrl.replace(/\/$/, '')}/v1beta/models/${model}:generateContent`;
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

  private isRetryableError(error: unknown) {
    return (
      error instanceof TypeError ||
      (error instanceof Error && error.name === 'TimeoutError')
    );
  }

  private backoff(attempt: number) {
    return new Promise((resolve) => {
      setTimeout(resolve, 250 * 2 ** attempt);
    });
  }
}
