import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { DbService } from '../db/db.service';

import { v4 as uuidv4, validate as isUuid } from 'uuid';
import { User, UserRole } from './types';

@Injectable()
export class UserService {
  constructor(private readonly db: DbService) {}

  getAll() {
    return this.db.users;
  }

  getById(id: string) {
    if (!isUuid(id)) {
      throw new BadRequestException('Invalid UUID');
    }

    const user = this.db.users.find((u) => u.id === id);

    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  create(createUserDto: CreateUserDto) {
    if (!createUserDto.login || !createUserDto.password) {
      throw new BadRequestException('Missing login or password');
    }

    const newUser: User = {
      id: uuidv4(),
      login: createUserDto.login,
      password: createUserDto.password,
      role: createUserDto.role || UserRole.VIEWER,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.db.users.push(newUser);
    return newUser;
  }

  updatePassword(id: string, updatePasswordDto: UpdatePasswordDto) {
    if (!isUuid(id)) {
      throw new BadRequestException('Invalid UUID');
    }

    const user = this.db.users.find((u) => u.id === id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.password !== updatePasswordDto.oldPassword) {
      throw new ForbiddenException('Wrong old password');
    }

    user.password = updatePasswordDto.newPassword;
    user.updatedAt = Date.now();
    return user;
  }

  remove(id: string) {
    if (!isUuid(id)) {
      throw new BadRequestException('Invalid UUID');
    }

    const index = this.db.users.findIndex((u) => u.id === id);
    if (index === -1) {
      throw new NotFoundException('User not found');
    }

    this.db.users.splice(index, 1);

    // Cascading delete
    this.db.articles.forEach((a) => {
      if (a.authorId === id) {
        a.authorId = null;
      }
    });
    this.db.comments = this.db.comments.filter((c) => c.authorId !== id);
  }
}
