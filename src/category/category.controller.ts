import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  HttpCode,
  Query,
  Req,
} from '@nestjs/common';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { PaginationQuery } from '../utils';
import { AuthenticatedRequest } from '../auth/auth.types';

@Controller('category')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  findAll(@Query() query: PaginationQuery) {
    return this.categoryService.getAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.categoryService.getById(id);
  }

  @Post()
  create(
    @Body() createCategoryDto: CreateCategoryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.categoryService.create(createCategoryDto, req.user!);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.categoryService.update(id, updateCategoryDto, req.user!);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.categoryService.remove(id, req.user!);
  }
}
