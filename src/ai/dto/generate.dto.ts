import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GenerateDto {
  @IsString()
  @IsNotEmpty()
  prompt: string;

  @IsString()
  @IsOptional()
  systemInstruction?: string;
}
