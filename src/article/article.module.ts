import { Module } from '@nestjs/common';
import { ArticleService } from './article.service';
import { ArticleController } from './article.controller';
import { DbModule } from '../db/db.module';
import { RagModule } from '../ai/rag/rag.module';

@Module({
  controllers: [ArticleController],
  providers: [ArticleService],
  exports: [ArticleService],
  imports: [DbModule, RagModule],
})
export class ArticleModule {}
