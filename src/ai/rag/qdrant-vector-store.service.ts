import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AppLogger } from '../../common/logging/app-logger.service';
import { getRagConfig } from './rag-config';
import { RagChunk, RagSearchResult, VectorSearchFilters } from './rag.types';

interface QdrantPoint {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
}

interface QdrantSearchPoint {
  score?: number;
  payload?: {
    articleId?: string;
    articleTitle?: string;
    chunk?: string;
    chunkIndex?: number;
  };
}

@Injectable()
export class QdrantVectorStoreService {
  constructor(private readonly logger: AppLogger) {}

  get collectionName() {
    return getRagConfig().vectorCollection;
  }

  async recreateCollection(vectorSize: number) {
    const exists = await this.collectionExists();

    if (exists) {
      await this.request(`/collections/${this.collectionName}`, {
        method: 'DELETE',
      });
    }

    await this.request(`/collections/${this.collectionName}`, {
      method: 'PUT',
      body: {
        vectors: {
          size: vectorSize,
          distance: 'Cosine',
        },
      },
    });
  }

  async ensureCollection(vectorSize: number) {
    const exists = await this.collectionExists();

    if (!exists) {
      await this.recreateCollection(vectorSize);
    }
  }

  async upsertChunks(chunks: RagChunk[], embeddings: number[][]) {
    if (chunks.length === 0) {
      return;
    }

    const points: QdrantPoint[] = chunks.map((chunk, index) => ({
      id: chunk.id,
      vector: embeddings[index],
      payload: {
        articleId: chunk.articleId,
        articleTitle: chunk.articleTitle,
        articleStatus: chunk.articleStatus,
        categoryId: chunk.categoryId,
        tags: chunk.tags,
        chunk: chunk.chunk,
        chunkIndex: chunk.chunkIndex,
      },
    }));

    await this.request(`/collections/${this.collectionName}/points?wait=true`, {
      method: 'PUT',
      body: { points },
    });
  }

  async search(
    vector: number[],
    limit: number,
    filters: VectorSearchFilters = {},
  ): Promise<RagSearchResult[]> {
    await this.ensureCollection(vector.length);

    const payload = await this.request<{ result?: QdrantSearchPoint[] }>(
      `/collections/${this.collectionName}/points/search`,
      {
        method: 'POST',
        body: {
          vector,
          limit,
          with_payload: true,
          filter: this.buildFilter(filters),
        },
      },
    );

    return (payload.result ?? [])
      .filter((point) => point.payload?.articleId && point.payload.chunk)
      .map((point) => ({
        articleId: point.payload!.articleId!,
        articleTitle: point.payload!.articleTitle ?? '',
        chunk: point.payload!.chunk!,
        similarity: point.score ?? 0,
        chunkIndex:
          typeof point.payload!.chunkIndex === 'number'
            ? point.payload!.chunkIndex
            : 0,
        retrievalMethods: ['semantic'],
        rankingScore: point.score ?? 0,
        semanticScore: point.score ?? 0,
      }));
  }

  async deleteArticle(articleId: string) {
    const found = await this.hasArticle(articleId);

    if (!found) {
      return false;
    }

    await this.request(
      `/collections/${this.collectionName}/points/delete?wait=true`,
      {
        method: 'POST',
        body: {
          filter: {
            must: [{ key: 'articleId', match: { value: articleId } }],
          },
        },
      },
    );

    return true;
  }

  async deleteArticles(articleIds: string[]) {
    for (const articleId of articleIds) {
      await this.deleteArticle(articleId);
    }
  }

  private async hasArticle(articleId: string) {
    const exists = await this.collectionExists();

    if (!exists) {
      return false;
    }

    const payload = await this.request<{ result?: { points?: unknown[] } }>(
      `/collections/${this.collectionName}/points/scroll`,
      {
        method: 'POST',
        body: {
          limit: 1,
          with_payload: false,
          with_vector: false,
          filter: {
            must: [{ key: 'articleId', match: { value: articleId } }],
          },
        },
      },
    );

    return Boolean(payload.result?.points?.length);
  }

  private async collectionExists() {
    try {
      await this.request(`/collections/${this.collectionName}`, {
        method: 'GET',
      });

      return true;
    } catch (error) {
      if (error instanceof NotFoundException) {
        return false;
      }

      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      return false;
    }
  }

  private buildFilter(filters: VectorSearchFilters) {
    const must: Array<Record<string, unknown>> = [];

    if (filters.articleStatus) {
      must.push({
        key: 'articleStatus',
        match: { value: filters.articleStatus },
      });
    }

    if (filters.categoryId) {
      must.push({
        key: 'categoryId',
        match: { value: filters.categoryId },
      });
    }

    if (filters.tags?.length) {
      must.push({
        should: filters.tags.map((tag) => ({
          key: 'tags',
          match: { value: tag },
        })),
      });
    }

    return must.length ? { must } : undefined;
  }

  private async request<T = unknown>(
    path: string,
    options: { method: string; body?: unknown },
  ): Promise<T> {
    const config = getRagConfig();
    const url = `${config.vectorDbUrl.replace(/\/$/, '')}${path}`;

    try {
      const response = await fetch(url, {
        method: options.method,
        headers: options.body ? { 'Content-Type': 'application/json' } : {},
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: AbortSignal.timeout(10000),
      });

      if (response.status === 404) {
        throw new NotFoundException('Qdrant resource not found');
      }

      if (response.status === 409) {
        throw new ConflictException('Qdrant collection already exists');
      }

      if (!response.ok) {
        this.logger.writeLog(
          'error',
          'Vector database request failed',
          {
            statusCode: response.status,
            provider: config.vectorDbProvider,
          },
          'RAG',
        );

        throw new ServiceUnavailableException(
          'Vector database is temporarily unavailable',
        );
      }

      if (response.status === 204) {
        return undefined as T;
      }

      return (await response.json()) as T;
    } catch (error) {
      if (
        error instanceof ServiceUnavailableException ||
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }

      this.logger.writeLog(
        'error',
        'Vector database connection failed',
        {
          error: error instanceof Error ? error.name : String(error),
        },
        'RAG',
        error instanceof Error ? error.stack : undefined,
      );

      throw new ServiceUnavailableException(
        'Vector database is temporarily unavailable',
      );
    }
  }
}
