import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { DbService } from '../db/db.service';

import { v4 as uuidv4, validate as isUuid } from 'uuid';
import { Category } from './types';

@Injectable()
export class CategoryService {
  constructor(private readonly db: DbService) {}

  getAll() {
    return this.db.categories;
  }

  getById(id: string) {
    if (!isUuid(id)) {
      throw new BadRequestException('Invalid UUID');
    }
    const category = this.db.categories.find((c) => c.id === id);
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  create(createCategoryDto: CreateCategoryDto) {
    if (!createCategoryDto.name || !createCategoryDto.description) {
      throw new BadRequestException('Missing name or description');
    }
    const newCategory: Category = {
      id: uuidv4(),
      name: createCategoryDto.name,
      description: createCategoryDto.description,
    };
    this.db.categories.push(newCategory);
    return newCategory;
  }

  update(id: string, updateCategoryDto: UpdateCategoryDto) {
    if (!isUuid(id)) {
      throw new BadRequestException('Invalid UUID');
    }
    const category = this.db.categories.find((c) => c.id === id);
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    if (updateCategoryDto.name) {
      category.name = updateCategoryDto.name;
    }
    if (updateCategoryDto.description) {
      category.description = updateCategoryDto.description;
    }

    return category;
  }

  remove(id: string) {
    if (!isUuid(id)) {
      throw new BadRequestException('Invalid UUID');
    }
    const index = this.db.categories.findIndex((c) => c.id === id);
    if (index === -1) {
      throw new NotFoundException('Category not found');
    }

    this.db.categories.splice(index, 1);

    // Cascading delete
    this.db.articles.forEach((a) => {
      if (a.categoryId === id) {
        a.categoryId = null;
      }
    });
  }
}
