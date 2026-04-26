import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { DbService } from '../db/db.service';
import { applyPaginationAndSorting, PaginationQuery } from '../utils';
import { Role } from '@prisma/client';
import { validate as isUuid } from 'uuid';
import { AuthenticatedUser } from '../auth/auth.types';
import { AuthService } from '../auth/auth.service';
import { compare } from 'bcrypt';
import { sanitizeUser } from './user.mapper';
import { hasAdminPrivileges } from '../auth/bootstrap-admin';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../common/errors';

@Injectable()
export class UserService {
  constructor(
    private readonly db: DbService,
    private readonly authService: AuthService,
  ) {}

  async getAll(query: PaginationQuery = {}) {
    const users = await this.db.user.findMany({
      include: {
        articles: true,
        comments: true,
      },
    });

    const serializedUsers = users.map((user) => sanitizeUser(user));
    return applyPaginationAndSorting(serializedUsers, query);
  }

  async getById(id: string) {
    if (!isUuid(id)) {
      throw new ValidationError('Invalid UUID');
    }

    const user = await this.db.user.findUnique({
      where: { id },
      include: {
        articles: true,
        comments: true,
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return sanitizeUser(user);
  }

  async create(createUserDto: CreateUserDto, actor: AuthenticatedUser) {
    const isAdmin = await hasAdminPrivileges(this.db, actor);

    if (!isAdmin) {
      throw new ForbiddenError('Only admins can create users');
    }

    const existingUser = await this.db.user.findUnique({
      where: { login: createUserDto.login },
    });

    if (existingUser) {
      throw new ValidationError('Login already taken');
    }

    const newUser = await this.db.user.create({
      data: {
        login: createUserDto.login,
        password: await this.authService.hashPassword(createUserDto.password),
        role: createUserDto.role || Role.VIEWER,
      },
    });

    return sanitizeUser(newUser);
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    actor: AuthenticatedUser,
  ) {
    if (!isUuid(id)) {
      throw new ValidationError('Invalid UUID');
    }

    const hasRoleUpdate = updateUserDto.role !== undefined;
    const wantsPasswordUpdate =
      updateUserDto.oldPassword !== undefined ||
      updateUserDto.newPassword !== undefined;

    if (!hasRoleUpdate && !wantsPasswordUpdate) {
      throw new ValidationError('Update payload is empty');
    }

    const user = await this.db.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const isAdmin = await hasAdminPrivileges(this.db, actor);
    const isSelf = actor.id === id;

    if (!isAdmin && !isSelf) {
      throw new ForbiddenError('You can only update your own user');
    }

    if (hasRoleUpdate && !isAdmin) {
      throw new ForbiddenError('Only admins can change user roles');
    }

    const data: {
      password?: string;
      role?: Role;
    } = {};

    if (hasRoleUpdate) {
      data.role = updateUserDto.role;
    }

    if (wantsPasswordUpdate) {
      if (!updateUserDto.newPassword) {
        throw new ValidationError('newPassword is required');
      }

      if (updateUserDto.oldPassword) {
        const passwordMatches = await compare(
          updateUserDto.oldPassword,
          user.password,
        );

        if (!passwordMatches) {
          throw new ForbiddenError('Wrong old password');
        }
      } else if (!isAdmin) {
        throw new ValidationError('oldPassword is required');
      }

      data.password = await this.authService.hashPassword(
        updateUserDto.newPassword,
      );
    }

    const updated = await this.db.user.update({
      where: { id },
      data,
    });

    return sanitizeUser(updated);
  }

  async remove(id: string, actor: AuthenticatedUser) {
    if (!isUuid(id)) {
      throw new ValidationError('Invalid UUID');
    }

    const isAdmin = await hasAdminPrivileges(this.db, actor);

    if (!isAdmin && actor.id !== id) {
      throw new ForbiddenError('You can only delete your own user');
    }

    const user = await this.db.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    await this.db.user.delete({
      where: { id },
    });

    return { message: 'User deleted successfully' };
  }
}
