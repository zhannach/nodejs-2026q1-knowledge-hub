import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsEnum,
  IsUUID,
} from 'class-validator';
import { ArticleStatus } from '../types';

export class CreateArticleDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsEnum(ArticleStatus)
  @IsOptional()
  status?: ArticleStatus = ArticleStatus.DRAFT;

  @IsUUID(4)
  @IsOptional()
  authorId?: string | null;

  @IsUUID(4)
  @IsOptional()
  categoryId?: string | null;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[] = [];
}
