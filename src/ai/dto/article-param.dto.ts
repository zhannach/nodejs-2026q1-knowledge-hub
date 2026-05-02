import { IsUUID } from 'class-validator';

export class ArticleParamDto {
  @IsUUID(4)
  articleId: string;
}
