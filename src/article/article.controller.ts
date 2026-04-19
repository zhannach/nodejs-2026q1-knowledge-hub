import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  Query,
  HttpCode,
  Req,
} from '@nestjs/common';
import { ArticleService } from './article.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { PaginationQuery } from '../utils';
import { AuthenticatedRequest } from '../auth/auth.types';

@Controller('article')
export class ArticleController {
  constructor(private readonly articleService: ArticleService) {}

  @Get()
  findAll(@Query() query: PaginationQuery) {
    return this.articleService.getAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.articleService.getById(id);
  }

  @Post()
  create(
    @Body() createArticleDto: CreateArticleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.articleService.create(createArticleDto, req.user!);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateArticleDto: UpdateArticleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.articleService.update(id, updateArticleDto, req.user!);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.articleService.remove(id, req.user!);
  }
}
