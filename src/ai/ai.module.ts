import { Module } from '@nestjs/common';
import { ArticleModule } from '../article/article.module';
import { AppLogger } from '../common/logging/app-logger.service';
import { AiCacheService } from './ai-cache.service';
import { AiController } from './ai.controller';
import { AiRateLimitGuard } from './ai-rate-limit.guard';
import { AiService } from './ai.service';
import { AiUsageService } from './ai-usage.service';
import { GeminiService } from './gemini.service';
import { RagModule } from './rag/rag.module';

@Module({
  imports: [ArticleModule, RagModule],
  controllers: [AiController],
  providers: [
    AiService,
    GeminiService,
    AiCacheService,
    AiRateLimitGuard,
    AiUsageService,
    AppLogger,
  ],
})
export class AiModule {}
