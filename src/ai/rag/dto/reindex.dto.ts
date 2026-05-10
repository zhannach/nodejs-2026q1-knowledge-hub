import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class ReindexDto {
  @IsBoolean()
  @IsOptional()
  onlyPublished?: boolean;

  @IsBoolean()
  @IsOptional()
  incremental?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  articleIds?: string[];
}
