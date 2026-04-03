import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsStrongPassword,
} from 'class-validator';
import { UserRole } from '../types';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  login: string;

  @IsString()
  @IsNotEmpty()
  @IsStrongPassword({
    minLength: 8,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 1,
  })
  password: string;

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole = UserRole.VIEWER;
}
