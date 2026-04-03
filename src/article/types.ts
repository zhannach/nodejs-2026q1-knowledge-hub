export enum ArticleStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

export class Article {
  id: string;
  title: string;
  content: string;
  status: ArticleStatus;
  authorId: string | null; // refers to User
  categoryId: string | null; // refers to Category
  tags: string[];
  createdAt: number;
  updatedAt: number;
}
