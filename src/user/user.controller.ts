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
import { PaginationQuery } from '../utils';
import { User } from '@prisma/client';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  private excludePassword(user: User) {
    const result = { ...user };
    delete result.password;
    return result;
  }

  @Get()
  async getAll(@Query() query: PaginationQuery) {
    const res = await this.userService.getAll(query);

    const data = Array.isArray(res) ? res : res.data;
    return data.map((u) => this.excludePassword(u));
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    const user = await this.userService.getById(id);
    return this.excludePassword(user);
  }

  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    const user = await this.userService.create(createUserDto);
    return this.excludePassword(user);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updatePasswordDto: UpdatePasswordDto,
  ) {
    const updated = await this.userService.updatePassword(
      id,
      updatePasswordDto,
    );
    return this.excludePassword(updated);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.userService.remove(id);
  }
}
