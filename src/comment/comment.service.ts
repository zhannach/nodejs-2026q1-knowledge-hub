import {
  Injectable,
  NotFoundException,
  BadRequestException,
  HttpException,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { CreateCommentDto } from './dto/create-comment.dto';
import { DbService } from '../db/db.service';
import { applyPaginationAndSorting, PaginationQuery } from '../utils';
import { validate as isUuid } from 'uuid';
import { AuthenticatedUser } from '../auth/auth.types';
import { sanitizeUser } from '../user/user.mapper';
import { hasAdminPrivileges } from '../auth/bootstrap-admin';
import { Role } from '@prisma/client';

@Injectable()
export class CommentService {
  constructor(private readonly db: DbService) {}

  async findAllByArticle(query: PaginationQuery) {
    if (!query.articleId) {
      throw new BadRequestException('articleId query parameter is required');
    }

    if (!isUuid(query.articleId)) {
      throw new BadRequestException('Invalid UUID');
    }

    const comments = await this.db.comment.findMany({
      where: { articleId: query.articleId },
      include: {
        author: true,
      },
    });

    const transformed = comments.map((comment) =>
      this.serializeComment(comment),
    );

    return applyPaginationAndSorting(transformed, query);
  }

  async getById(id: string) {
    if (!isUuid(id)) {
      throw new BadRequestException('Invalid UUID');
    }

    const comment = await this.db.comment.findUnique({
      where: { id },
      include: {
        author: true,
        article: true,
      },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    return this.serializeComment(comment);
  }

  async create(createCommentDto: CreateCommentDto, actor: AuthenticatedUser) {
    const isAdmin = await hasAdminPrivileges(this.db, actor);

    if (actor.role === Role.VIEWER && !isAdmin) {
      throw new ForbiddenException('Viewers cannot create comments');
    }

    const authorId =
      actor.role === Role.EDITOR && !isAdmin
        ? actor.id
        : (createCommentDto.authorId ?? null);

    if (
      actor.role === Role.EDITOR &&
      !isAdmin &&
      createCommentDto.authorId &&
      createCommentDto.authorId !== actor.id
    ) {
      throw new ForbiddenException(
        'Editors can only create their own comments',
      );
    }

    const article = await this.db.article.findUnique({
      where: { id: createCommentDto.articleId },
    });

    if (!article) {
      throw new HttpException(
        'Article does not exist',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const newComment = await this.db.comment.create({
      data: {
        content: createCommentDto.content,

        article: {
          connect: { id: createCommentDto.articleId },
        },

        author: authorId
          ? {
              connect: { id: authorId },
            }
          : undefined,
      },
    });

    return this.serializeComment(newComment);
  }

  async remove(id: string, actor: AuthenticatedUser) {
    const isAdmin = await hasAdminPrivileges(this.db, actor);

    if (!isAdmin) {
      throw new ForbiddenException('Only admins can delete comments');
    }

    if (!isUuid(id)) {
      throw new BadRequestException('Invalid UUID');
    }

    const comment = await this.db.comment.findUnique({ where: { id } });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    await this.db.comment.delete({
      where: { id },
    });

    return { message: 'Comment deleted successfully' };
  }

  private serializeComment(comment: {
    id: string;
    content: string;
    articleId: string;
    authorId: string | null;
    createdAt: Date;
    author?: any;
    article?: any;
  }) {
    return {
      ...comment,
      author: comment.author ? sanitizeUser(comment.author) : comment.author,
      createdAt: comment.createdAt.getTime(),
    };
  }
}
