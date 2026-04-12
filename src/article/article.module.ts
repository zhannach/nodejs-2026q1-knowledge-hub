import { Module } from '@nestjs/common';
import { ArticleService } from './article.service';
import { ArticleController } from './article.controller';
import { DbModule } from 'src/db/db.module';

@Module({
  controllers: [ArticleController],
  providers: [ArticleService],
  exports: [ArticleService],
  imports: [DbModule],
})
export class ArticleModule {}
