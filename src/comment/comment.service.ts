import {
  Injectable,
  NotFoundException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { CreateCommentDto } from './dto/create-comment.dto';
import { DbService } from '../db/db.service';
import { Comment } from './types';
import { v4 as uuidv4, validate as isUuid } from 'uuid';

@Injectable()
export class CommentService {
  constructor(private readonly db: DbService) {}

  findAllByArticle(articleId: string) {
    if (!articleId) {
      throw new BadRequestException('articleId query parameter is required');
    }
    return this.db.comments.filter((c) => c.articleId === articleId);
  }

  getById(id: string) {
    if (!isUuid(id)) {
      throw new BadRequestException('Invalid UUID');
    }
    const comment = this.db.comments.find((c) => c.id === id);
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    return comment;
  }

  create(createCommentDto: CreateCommentDto) {
    if (!createCommentDto.content || !createCommentDto.articleId) {
      throw new BadRequestException('Missing content or articleId');
    }

    const article = this.db.articles.find(
      (a) => a.id === createCommentDto.articleId,
    );
    if (!article) {
      throw new HttpException(
        'Article does not exist',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const newComment: Comment = {
      id: uuidv4(),
      content: createCommentDto.content,
      articleId: createCommentDto.articleId,
      authorId: createCommentDto.authorId || null,
      createdAt: Date.now(),
    };
    this.db.comments.push(newComment);
    return newComment;
  }

  remove(id: string) {
    if (!isUuid(id)) {
      throw new BadRequestException('Invalid UUID');
    }
    const index = this.db.comments.findIndex((c) => c.id === id);
    if (index === -1) {
      throw new NotFoundException('Comment not found');
    }

    this.db.comments.splice(index, 1);
  }
}
