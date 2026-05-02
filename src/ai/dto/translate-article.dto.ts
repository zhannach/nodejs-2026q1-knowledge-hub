import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class TranslateArticleDto {
  @IsString()
  @IsNotEmpty()
  targetLanguage: string;

  @IsString()
  @IsOptional()
  sourceLanguage?: string;
}
