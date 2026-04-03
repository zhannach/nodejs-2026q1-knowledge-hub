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
  @IsStrongPassword(
    {
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,

      minSymbols: 1,
    },
    {
      message:
        'password must be at least 8 characters long, containing at least 1 lowercase letter, 1 uppercase letter, 1 number, and 1 special symbol.',
    },
  )
  password: string;

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole = UserRole.VIEWER;
}
