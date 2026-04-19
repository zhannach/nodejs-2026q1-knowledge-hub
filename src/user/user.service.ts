import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
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
      throw new BadRequestException('Invalid UUID');
    }

    const user = await this.db.user.findUnique({
      where: { id },
      include: {
        articles: true,
        comments: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return sanitizeUser(user);
  }

  async create(createUserDto: CreateUserDto, actor: AuthenticatedUser) {
    const isAdmin = await hasAdminPrivileges(this.db, actor);

    if (!isAdmin) {
      throw new ForbiddenException('Only admins can create users');
    }

    const existingUser = await this.db.user.findUnique({
      where: { login: createUserDto.login },
    });

    if (existingUser) {
      throw new BadRequestException('Login already taken');
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
      throw new BadRequestException('Invalid UUID');
    }

    const user = await this.db.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isAdmin = await hasAdminPrivileges(this.db, actor);
    const isSelf = actor.id === id;

    if (!isAdmin && !isSelf) {
      throw new ForbiddenException('You can only update your own user');
    }

    const hasRoleUpdate = updateUserDto.role !== undefined;
    const wantsPasswordUpdate =
      updateUserDto.oldPassword !== undefined ||
      updateUserDto.newPassword !== undefined;

    if (!hasRoleUpdate && !wantsPasswordUpdate) {
      throw new BadRequestException('Update payload is empty');
    }

    if (hasRoleUpdate && !isAdmin) {
      throw new ForbiddenException('Only admins can change user roles');
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
        throw new BadRequestException('newPassword is required');
      }

      if (!isAdmin) {
        if (!updateUserDto.oldPassword) {
          throw new BadRequestException('oldPassword is required');
        }

        const passwordMatches = await compare(
          updateUserDto.oldPassword,
          user.password,
        );

        if (!passwordMatches) {
          throw new ForbiddenException('Wrong old password');
        }
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
      throw new BadRequestException('Invalid UUID');
    }

    const isAdmin = await hasAdminPrivileges(this.db, actor);

    if (!isAdmin && actor.id !== id) {
      throw new ForbiddenException('You can only delete your own user');
    }

    const user = await this.db.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.db.user.delete({
      where: { id },
    });

    return { message: 'User deleted successfully' };
  }
}
