import { Injectable } from '@nestjs/common';
import { AppLogger } from '../../common/logging/app-logger.service';
import { RagService } from './rag.service';

@Injectable()
export class RagIndexSyncService {
  constructor(
    private readonly ragService: RagService,
    private readonly logger: AppLogger,
  ) {}

  async syncArticle(articleId: string) {
    try {
      await this.ragService.reindex({
        articleIds: [articleId],
        onlyPublished: true,
      });
    } catch (error) {
      this.logger.writeLog(
        'warn',
        'Automatic RAG reindex failed for article change',
        { articleId },
        'RAG',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async deleteArticle(articleId: string) {
    try {
      await this.ragService.deleteArticleFromIndex(articleId, {
        ignoreMissing: true,
      });
    } catch (error) {
      this.logger.writeLog(
        'warn',
        'Automatic RAG delete failed for article removal',
        { articleId },
        'RAG',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
