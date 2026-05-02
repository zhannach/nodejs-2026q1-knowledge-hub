import { IsEnum, IsOptional } from 'class-validator';

export enum SummaryLength {
  SHORT = 'short',
  MEDIUM = 'medium',
  DETAILED = 'detailed',
}

export class SummarizeArticleDto {
  @IsEnum(SummaryLength)
  @IsOptional()
  maxLength?: SummaryLength = SummaryLength.MEDIUM;
}
