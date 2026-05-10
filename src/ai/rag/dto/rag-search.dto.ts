import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RagSearchDto {
  @IsString()
  @IsNotEmpty()
  query: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  @IsOptional()
  limit?: number;

  @IsIn(['draft', 'published', 'archived'])
  @IsOptional()
  articleStatus?: 'draft' | 'published' | 'archived';

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}
