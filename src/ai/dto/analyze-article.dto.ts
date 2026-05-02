import { IsEnum, IsOptional } from 'class-validator';

export enum AnalyzeTask {
  REVIEW = 'review',
  BUGS = 'bugs',
  OPTIMIZE = 'optimize',
  EXPLAIN = 'explain',
}

export class AnalyzeArticleDto {
  @IsEnum(AnalyzeTask)
  @IsOptional()
  task?: AnalyzeTask = AnalyzeTask.REVIEW;
}
