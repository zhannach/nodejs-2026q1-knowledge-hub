import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { RagArticleIndexState } from '@prisma/client';
import { DbService } from '../../db/db.service';
import { ArticleForRag } from './rag.types';

@Injectable()
export class RagIndexStateService {
  constructor(private readonly db: DbService) {}

  buildContentHash(article: ArticleForRag) {
    return createHash('sha256')
      .update(
        JSON.stringify({
          title: article.title,
          content: article.content,
          status: article.status,
          categoryId: article.categoryId,
          tags: article.tags.map((tag) => tag.name).sort(),
        }),
      )
      .digest('hex');
  }

  async getStates(articleIds?: string[]): Promise<RagArticleIndexState[]> {
    return this.db.ragArticleIndexState.findMany({
      where: articleIds?.length ? { articleId: { in: articleIds } } : undefined,
    });
  }

  async getStateMap(
    articleIds?: string[],
  ): Promise<Map<string, RagArticleIndexState>> {
    const states = await this.getStates(articleIds);
    return new Map(states.map((state) => [state.articleId, state]));
  }

  async upsertStates(articles: ArticleForRag[]) {
    for (const article of articles) {
      await this.db.ragArticleIndexState.upsert({
        where: { articleId: article.id },
        create: {
          articleId: article.id,
          contentHash: this.buildContentHash(article),
          articleStatus: article.status,
          articleUpdatedAt: article.updatedAt,
        },
        update: {
          contentHash: this.buildContentHash(article),
          articleStatus: article.status,
          articleUpdatedAt: article.updatedAt,
          indexedAt: new Date(),
        },
      });
    }
  }

  async deleteStates(articleIds: string[]) {
    if (!articleIds.length) {
      return;
    }

    await this.db.ragArticleIndexState.deleteMany({
      where: { articleId: { in: articleIds } },
    });
  }

  async recreateStates(articles: ArticleForRag[]) {
    await this.db.ragArticleIndexState.deleteMany({});
    await this.upsertStates(articles);
  }
}
