import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  HttpCode,
  Req,
} from '@nestjs/common';
import { CommentService } from './comment.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { PaginationQuery } from '../utils';
import { AuthenticatedRequest } from '../auth/auth.types';

@Controller('comment')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Get()
  findAll(@Query() query: PaginationQuery) {
    return this.commentService.findAllByArticle(query);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.commentService.getById(id);
  }

  @Post()
  create(
    @Body() createCommentDto: CreateCommentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.commentService.create(createCommentDto, req.user!);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.commentService.remove(id, req.user!);
  }
}
