import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { DbService } from '../db/db.service';
import { applyPaginationAndSorting, PaginationQuery } from '../utils';
import { ArticleStatus } from '@prisma/client';

@Injectable()
export class ArticleService {
  constructor(private readonly db: DbService) {}

  async getAll(query: PaginationQuery) {
    const { status, categoryId, tag } = query;

    const articles = await this.db.article.findMany({
      where: {
        status: status as ArticleStatus | undefined,
        categoryId: categoryId || undefined,
        tags: tag
          ? {
              some: {
                name: tag,
              },
            }
          : undefined,
      },
      include: {
        tags: true,
        category: true,
        author: true,
      },
    });

    const transformed = articles.map((a) => ({
      ...a,
      tags: a.tags.map((t) => t.name),
      createdAt: a.createdAt.getTime(),
      updatedAt: a.updatedAt.getTime(),
    }));

    return applyPaginationAndSorting(transformed as any, query);
  }

  async getById(id: string) {
    if (!id) {
      throw new BadRequestException('Invalid ID');
    }

    const article = await this.db.article.findUnique({
      where: { id },
      include: {
        tags: true,
        category: true,
        author: true,
      },
    });

    if (!article) {
      throw new NotFoundException('Article not found');
    }

    return {
      ...article,
      tags: article.tags.map((t) => t.name),
      createdAt: article.createdAt.getTime(),
      updatedAt: article.updatedAt.getTime(),
    };
  }

  async create(createArticleDto: CreateArticleDto) {
    if (!createArticleDto.title || !createArticleDto.content) {
      throw new BadRequestException('Missing title or content');
    }

    const article = await this.db.article.create({
      data: {
        title: createArticleDto.title,
        content: createArticleDto.content,
        status:
          (createArticleDto.status as ArticleStatus) || ArticleStatus.DRAFT,
        authorId: createArticleDto.authorId || null,
        categoryId: createArticleDto.categoryId || null,

        tags: {
          connectOrCreate: (createArticleDto.tags || []).map((tag) => ({
            where: { name: tag },
            create: { name: tag },
          })),
        },
      },
      include: {
        tags: true,
        category: true,
        author: true,
      },
    });

    return {
      ...article,
      tags: article.tags.map((t) => t.name),
      createdAt: article.createdAt.getTime(),
      updatedAt: article.updatedAt.getTime(),
    };
  }

  async update(id: string, updateArticleDto: UpdateArticleDto) {
    const article = await this.db.article.findUnique({
      where: { id },
    });

    if (!article) {
      throw new NotFoundException('Article not found');
    }

    const updated = await this.db.article.update({
      where: { id },
      data: {
        title: updateArticleDto.title,
        content: updateArticleDto.content,
        status: updateArticleDto.status as ArticleStatus | undefined,

        categoryId: updateArticleDto.categoryId,

        tags: updateArticleDto.tags
          ? {
              set: [],
              connectOrCreate: updateArticleDto.tags.map((tag) => ({
                where: { name: tag },
                create: { name: tag },
              })),
            }
          : undefined,
      },
      include: {
        tags: true,
        category: true,
        author: true,
      },
    });

    return {
      ...updated,
      tags: updated.tags.map((t) => t.name),
      createdAt: updated.createdAt.getTime(),
      updatedAt: updated.updatedAt.getTime(),
    };
  }

  async remove(id: string) {
    const article = await this.db.article.findUnique({
      where: { id },
    });

    if (!article) {
      throw new NotFoundException('Article not found');
    }

    await this.db.article.delete({
      where: { id },
    });

    return { message: 'Article deleted successfully' };
  }
}
