import { Injectable } from '@nestjs/common';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { DbService } from '../db/db.service';

import { v4 as uuidv4, validate as isUuid } from 'uuid';
import { applyPaginationAndSorting, PaginationQuery } from '../utils';
import { Category } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { hasAdminPrivileges } from '../auth/bootstrap-admin';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../common/errors';

@Injectable()
export class CategoryService {
  constructor(private readonly db: DbService) {}

  async getAll(query: PaginationQuery = {}) {
    const categories = await this.db.category.findMany();
    return applyPaginationAndSorting(categories as Category[], query);
  }

  async getById(id: string) {
    if (!isUuid(id)) {
      throw new ValidationError('Invalid UUID');
    }
    const category = await this.db.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundError('Category not found');
    }
    return category as unknown as Category;
  }

  async create(createCategoryDto: CreateCategoryDto, actor: AuthenticatedUser) {
    const isAdmin = await hasAdminPrivileges(this.db, actor);

    if (!isAdmin) {
      throw new ForbiddenError('Only admins can manage categories');
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

  async update(
    id: string,
    updateCategoryDto: UpdateCategoryDto,
    actor: AuthenticatedUser,
  ) {
    const isAdmin = await hasAdminPrivileges(this.db, actor);

    if (!isAdmin) {
      throw new ForbiddenError('Only admins can manage categories');
    }

    if (!isUuid(id)) {
      throw new ValidationError('Invalid UUID');
    }
    const category = await this.db.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundError('Category not found');
    }

    const updated = await this.db.category.update({
      where: { id },
      data: updateCategoryDto,
    });

    return updated as unknown as Category;
  }

  async remove(id: string, actor: AuthenticatedUser) {
    const isAdmin = await hasAdminPrivileges(this.db, actor);

    if (!isAdmin) {
      throw new ForbiddenError('Only admins can manage categories');
    }

    if (!isUuid(id)) {
      throw new ValidationError('Invalid UUID');
    }
    const category = await this.db.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundError('Category not found');
    }

    await this.db.category.delete({ where: { id } });
  }
}
