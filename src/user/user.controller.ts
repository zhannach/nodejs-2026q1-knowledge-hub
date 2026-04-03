import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  HttpCode,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  private excludePassword(user: any) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...result } = user;
    return result;
  }

  @Get()
  getAll() {
    return this.userService.getAll().map((u) => this.excludePassword(u));
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
