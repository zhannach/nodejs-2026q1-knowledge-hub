import { Role } from '@prisma/client';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  login: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  password: string;

  @IsEnum(Role)
  @IsOptional()
  role?: Role = Role.VIEWER;
}
