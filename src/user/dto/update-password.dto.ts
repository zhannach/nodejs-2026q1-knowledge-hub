import { IsString, IsNotEmpty, IsStrongPassword } from 'class-validator';

export class UpdatePasswordDto {
  @IsString()
  @IsNotEmpty()
  oldPassword: string;

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
        'newPassword must be at least 8 characters long, containing at least 1 lowercase letter, 1 uppercase letter, 1 number, and 1 special symbol.',
    },
  )
  newPassword: string;
}
