export interface Comment {
  id: string;
  content: string;
  articleId: string; // refers to Article
  authorId: string | null; // refers to User
  createdAt: number;
}
