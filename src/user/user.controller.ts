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
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { User } from './types';
import { PaginationQuery } from '../utils';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  private excludePassword(user: User) {
    const result = { ...user };
    delete result.password;
    return result;
  }

  @Get()
  getAll(@Query() query: PaginationQuery) {
    const res = this.userService.getAll(query);
    if (!Array.isArray(res)) {
      return { ...res, data: res.data.map((u) => this.excludePassword(u)) };
    }
    return res.map((u) => this.excludePassword(u));
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.excludePassword(this.userService.getById(id));
  }

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.excludePassword(this.userService.create(createUserDto));
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updatePasswordDto: UpdatePasswordDto,
  ) {
    return this.excludePassword(
      this.userService.updatePassword(id, updatePasswordDto),
    );
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    this.userService.remove(id);
  }
}
