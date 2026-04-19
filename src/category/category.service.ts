import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { DbService } from '../db/db.service';

import { v4 as uuidv4, validate as isUuid } from 'uuid';
import { applyPaginationAndSorting, PaginationQuery } from '../utils';
import { Category } from '@prisma/client';

@Injectable()
export class CategoryService {
  constructor(private readonly db: DbService) {}

  async getAll(query: PaginationQuery = {}) {
    const categories = await this.db.category.findMany();
    return applyPaginationAndSorting(categories as Category[], query);
  }

  async getById(id: string) {
    if (!isUuid(id)) {
      throw new BadRequestException('Invalid UUID');
    }
    const category = await this.db.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category as unknown as Category;
  }

  async create(createCategoryDto: CreateCategoryDto) {
    if (!createCategoryDto.name || !createCategoryDto.description) {
      throw new BadRequestException('Missing name or description');
    }
    const newCategory = await this.db.category.create({
      data: {
        id: uuidv4(),
        name: createCategoryDto.name,
        description: createCategoryDto.description,
      },
    });
    return newCategory as unknown as Category;
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    if (!isUuid(id)) {
      throw new BadRequestException('Invalid UUID');
    }
    const category = await this.db.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const updated = await this.db.category.update({
      where: { id },
      data: updateCategoryDto,
    });

    return updated as unknown as Category;
  }

  async remove(id: string) {
    if (!isUuid(id)) {
      throw new BadRequestException('Invalid UUID');
    }
    const category = await this.db.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    await this.db.category.delete({ where: { id } });
  }
}
