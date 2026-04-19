import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { UserModule } from './user/user.module';
import { ArticleModule } from './article/article.module';
import { CategoryModule } from './category/category.module';
import { CommentModule } from './comment/comment.module';
import { DbModule } from './db/db.module';
import { LoggerMiddleware } from './logger.middleware';

@Module({
  imports: [DbModule, UserModule, ArticleModule, CategoryModule, CommentModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
