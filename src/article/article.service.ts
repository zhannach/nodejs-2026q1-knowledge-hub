import { Injectable } from '@nestjs/common';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { DbService } from '../db/db.service';
import { applyPaginationAndSorting, PaginationQuery } from '../utils';
import { ArticleStatus, Role } from '@prisma/client';
import { validate as isUuid } from 'uuid';
import { AuthenticatedUser } from '../auth/auth.types';
import { sanitizeUser } from '../user/user.mapper';
import { hasAdminPrivileges } from '../auth/bootstrap-admin';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../common/errors';
import { RagIndexSyncService } from '../ai/rag/rag-index-sync.service';

@Injectable()
export class ArticleService {
  constructor(
    private readonly db: DbService,
    private readonly ragIndexSync: RagIndexSyncService,
  ) {}

  private readonly allowedStatusTransitions: Record<
    ArticleStatus,
    ArticleStatus[]
  > = {
    [ArticleStatus.DRAFT]: [ArticleStatus.PUBLISHED],
    [ArticleStatus.PUBLISHED]: [ArticleStatus.ARCHIVED],
    [ArticleStatus.ARCHIVED]: [],
  };

  async getAll(query: PaginationQuery) {
    const { status, categoryId, tag } = query;

    const articles = await this.db.article.findMany({
      where: {
        status: status ? (status.toUpperCase() as ArticleStatus) : undefined,
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

    const transformed = articles.map((article) =>
      this.serializeArticle(article),
    );

    return applyPaginationAndSorting(transformed as any, query);
  }

  async getById(id: string) {
    if (!isUuid(id)) {
      throw new ValidationError('Invalid UUID');
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
      throw new NotFoundError('Article not found');
    }

    return this.serializeArticle(article);
  }

  async create(createArticleDto: CreateArticleDto, actor: AuthenticatedUser) {
    const isAdmin = await hasAdminPrivileges(this.db, actor);

    if (actor.role === Role.VIEWER && !isAdmin) {
      throw new ForbiddenError('Viewers cannot create articles');
    }

    const authorId =
      actor.role === Role.EDITOR && !isAdmin
        ? actor.id
        : (createArticleDto.authorId ?? null);

    if (
      actor.role === Role.EDITOR &&
      !isAdmin &&
      createArticleDto.authorId &&
      createArticleDto.authorId !== actor.id
    ) {
      throw new ForbiddenError('Editors can only create their own articles');
    }

    const article = await this.db.article.create({
      data: {
        title: createArticleDto.title,
        content: createArticleDto.content,
        status: createArticleDto.status ?? ArticleStatus.DRAFT,
        authorId,
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

    await this.ragIndexSync.syncArticle(article.id);

    return this.serializeArticle(article);
  }

  async update(
    id: string,
    updateArticleDto: UpdateArticleDto,
    actor: AuthenticatedUser,
  ) {
    const isAdmin = await hasAdminPrivileges(this.db, actor);

    if (actor.role === Role.VIEWER && !isAdmin) {
      throw new ForbiddenError('Viewers cannot update articles');
    }

    if (!isUuid(id)) {
      throw new ValidationError('Invalid UUID');
    }

    const article = await this.db.article.findUnique({
      where: { id },
    });

    if (!article) {
      throw new NotFoundError('Article not found');
    }

    if (
      actor.role === Role.EDITOR &&
      !isAdmin &&
      article.authorId !== actor.id
    ) {
      throw new ForbiddenError('Editors can only update their own articles');
    }

    if (
      actor.role === Role.EDITOR &&
      !isAdmin &&
      updateArticleDto.authorId &&
      updateArticleDto.authorId !== actor.id
    ) {
      throw new ForbiddenError('Editors cannot reassign article ownership');
    }

    if (
      updateArticleDto.status &&
      !this.isValidStatusTransition(article.status, updateArticleDto.status)
    ) {
      throw new ValidationError(
        `Invalid status transition from ${article.status.toLowerCase()} to ${updateArticleDto.status.toLowerCase()}`,
      );
    }

    const updated = await this.db.article.update({
      where: { id },
      data: {
        title: updateArticleDto.title,
        content: updateArticleDto.content,
        status: updateArticleDto.status as ArticleStatus | undefined,
        authorId: isAdmin ? updateArticleDto.authorId : undefined,

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

    await this.ragIndexSync.syncArticle(updated.id);

    return this.serializeArticle(updated);
  }

  async remove(id: string, actor: AuthenticatedUser) {
    const isAdmin = await hasAdminPrivileges(this.db, actor);

    if (!isAdmin) {
      throw new ForbiddenError('Only admins can delete articles');
    }

    if (!isUuid(id)) {
      throw new ValidationError('Invalid UUID');
    }

    const article = await this.db.article.findUnique({
      where: { id },
    });

    if (!article) {
      throw new NotFoundError('Article not found');
    }

    await this.db.article.delete({
      where: { id },
    });
    await this.ragIndexSync.deleteArticle(id);

    return { message: 'Article deleted successfully' };
  }

  private serializeArticle(article: {
    id: string;
    title: string;
    content: string;
    status: ArticleStatus;
    createdAt: Date;
    updatedAt: Date;
    authorId: string | null;
    categoryId: string | null;
    tags: { name: string }[];
    author?: any;
    category?: any;
  }) {
    return {
      ...article,
      status: article.status.toLowerCase(),
      tags: article.tags.map((tag) => tag.name),
      author: article.author ? sanitizeUser(article.author) : article.author,
      createdAt: article.createdAt.getTime(),
      updatedAt: article.updatedAt.getTime(),
    };
  }

  private isValidStatusTransition(
    currentStatus: ArticleStatus,
    nextStatus: ArticleStatus,
  ) {
    if (currentStatus === nextStatus) {
      return true;
    }

    return this.allowedStatusTransitions[currentStatus].includes(nextStatus);
  }
}
