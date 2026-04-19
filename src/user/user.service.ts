import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { DbService } from '../db/db.service';
import { applyPaginationAndSorting, PaginationQuery } from '../utils';
import { Role } from '@prisma/client';

@Injectable()
export class UserService {
  constructor(private readonly db: DbService) {}

  async getAll(query: PaginationQuery = {}) {
    const users = await this.db.user.findMany({
      include: {
        articles: true,
        comments: true,
      },
    });

    return applyPaginationAndSorting(users, query);
  }

  async getById(id: string) {
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

    return user;
  }

  async create(createUserDto: CreateUserDto) {
    if (!createUserDto.login || !createUserDto.password) {
      throw new BadRequestException('Missing login or password');
    }

    const newUser = await this.db.user.create({
      data: {
        login: createUserDto.login,
        password: createUserDto.password,
        role: createUserDto.role || Role.VIEWER,
      },
    });

    return newUser;
  }

  async updatePassword(id: string, updatePasswordDto: UpdatePasswordDto) {
    const user = await this.db.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.password !== updatePasswordDto.oldPassword) {
      throw new ForbiddenException('Wrong old password');
    }

    const updated = await this.db.user.update({
      where: { id },
      data: {
        password: updatePasswordDto.newPassword,
      },
    });

    return updated;
  }

  async remove(id: string) {
    const user = await this.db.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.db.user.delete({
      where: { id },
    });

    return { message: 'User deleted successfully' };
  }
}
