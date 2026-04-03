import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { DbService } from '../db/db.service';

import { v4 as uuidv4, validate as isUuid } from 'uuid';
import { Article, ArticleStatus } from './types';

@Injectable()
export class ArticleService {
  constructor(private readonly db: DbService) {}

  getAll(query: any) {
    let result = this.db.articles;

    if (query.status) {
      result = result.filter((a) => a.status === query.status);
    }
    if (query.categoryId) {
      result = result.filter((a) => a.categoryId === query.categoryId);
    }
    if (query.tag) {
      result = result.filter((a) => a.tags.includes(query.tag));
    }
    return result;
  }

  getById(id: string) {
    if (!isUuid(id)) {
      throw new BadRequestException('Invalid UUID');
    }
    const article = this.db.articles.find((a) => a.id === id);
    if (!article) {
      throw new NotFoundException('Article not found');
    }
    return article;
  }

  create(createArticleDto: CreateArticleDto) {
    if (!createArticleDto.title || !createArticleDto.content) {
      throw new BadRequestException('Missing title or content');
    }
    const newArticle: Article = {
      id: uuidv4(),
      title: createArticleDto.title,
      content: createArticleDto.content,
      status: createArticleDto.status || ArticleStatus.DRAFT,
      authorId: createArticleDto.authorId || null,
      categoryId: createArticleDto.categoryId || null,
      tags: createArticleDto.tags || [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.db.articles.push(newArticle);
    return newArticle;
  }

  update(id: string, updateArticleDto: UpdateArticleDto) {
    if (!isUuid(id)) {
      throw new BadRequestException('Invalid UUID');
    }
    const article = this.db.articles.find((a) => a.id === id);
    if (!article) {
      throw new NotFoundException('Article not found');
    }

    Object.assign(article, updateArticleDto);

    article.updatedAt = Date.now();
    return article;
  }

  remove(id: string) {
    if (!isUuid(id)) {
      throw new BadRequestException('Invalid UUID');
    }
    const index = this.db.articles.findIndex((a) => a.id === id);
    if (index === -1) {
      throw new NotFoundException('Article not found');
    }

    this.db.articles.splice(index, 1);

    // Cascading delete
    this.db.comments = this.db.comments.filter((c) => c.articleId !== id);
  }
}
