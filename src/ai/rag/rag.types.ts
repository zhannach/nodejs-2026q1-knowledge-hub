export interface ArticleForRag {
  id: string;
  title: string;
  content: string;
  status: string;
  categoryId: string | null;
  tags: Array<{ name: string }>;
  updatedAt: Date;
}

export interface RagChunk {
  id: string;
  articleId: string;
  articleTitle: string;
  articleStatus: string;
  categoryId: string | null;
  tags: string[];
  chunk: string;
  chunkIndex: number;
}

export interface VectorSearchFilters {
  articleStatus?: 'draft' | 'published' | 'archived';
  categoryId?: string;
  tags?: string[];
}

export interface RagSearchResult {
  articleId: string;
  articleTitle: string;
  chunk: string;
  similarity: number;
  chunkIndex: number;
  retrievalMethods: Array<'semantic' | 'lexical'>;
  rankingScore: number;
  semanticScore?: number;
  lexicalScore?: number;
  rerankScore?: number;
}
