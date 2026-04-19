import {
  Injectable,
  NotFoundException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { CreateCommentDto } from './dto/create-comment.dto';
import { DbService } from '../db/db.service';
import { applyPaginationAndSorting, PaginationQuery } from '../utils';

@Injectable()
export class CommentService {
  constructor(private readonly db: DbService) {}

  async findAllByArticle(query: PaginationQuery) {
    if (!query.articleId) {
      throw new BadRequestException('articleId query parameter is required');
    }

    const comments = await this.db.comment.findMany({
      where: { articleId: query.articleId },
      include: {
        author: true,
      },
    });

    const transformed = comments.map((c) => ({
      ...c,
      createdAt: c.createdAt.getTime(),
    }));

    return applyPaginationAndSorting(transformed, query);
  }

  async getById(id: string) {
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

    return {
      ...comment,
      createdAt: comment.createdAt.getTime(),
    };
  }

  async create(createCommentDto: CreateCommentDto) {
    if (!createCommentDto.content || !createCommentDto.articleId) {
      throw new BadRequestException('Missing content or articleId');
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

        author: createCommentDto.authorId
          ? {
              connect: { id: createCommentDto.authorId },
            }
          : undefined,
      },
    });

    return {
      ...newComment,
      createdAt: newComment.createdAt.getTime(),
    };
  }

  async remove(id: string) {
    const comment = await this.db.comment.findUnique({ where: { id } });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    await this.db.comment.delete({
      where: { id },
    });

    return { message: 'Comment deleted successfully' };
  }
}
