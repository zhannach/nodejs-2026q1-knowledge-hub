import { Injectable } from '@nestjs/common';
import { v5 as uuidv5 } from 'uuid';
import { getRagConfig } from './rag-config';
import { ArticleForRag, RagChunk } from './rag.types';

const RAG_CHUNK_NAMESPACE = 'f70d62b8-3bdf-4a08-9fc9-7399472cb23a';

@Injectable()
export class RagChunkerService {
  chunkArticle(article: ArticleForRag): RagChunk[] {
    const config = getRagConfig();
    const chunkSize = config.chunkSize;
    const overlap = Math.min(config.chunkOverlap, Math.max(0, chunkSize - 1));
    const text = this.normalizeArticleText(article);
    const chunks: RagChunk[] = [];
    let start = 0;
    let chunkIndex = 0;

    while (start < text.length) {
      const end = this.findStableChunkEnd(text, start, chunkSize);
      const chunk = text.slice(start, end).trim();

      if (chunk.length > 0) {
        chunks.push({
          id: uuidv5(
            `${article.id}:${chunkIndex}:${chunk}`,
            RAG_CHUNK_NAMESPACE,
          ),
          articleId: article.id,
          articleTitle: article.title,
          articleStatus: article.status.toLowerCase(),
          categoryId: article.categoryId,
          tags: article.tags.map((tag) => tag.name),
          chunk,
          chunkIndex,
        });
        chunkIndex++;
      }

      if (end >= text.length) {
        break;
      }

      start = Math.max(end - overlap, start + 1);
    }

    return chunks;
  }

  private normalizeArticleText(article: ArticleForRag) {
    return [`Title: ${article.title}`, article.content]
      .join('\n\n')
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private findStableChunkEnd(text: string, start: number, chunkSize: number) {
    const hardEnd = Math.min(start + chunkSize, text.length);

    if (hardEnd >= text.length) {
      return text.length;
    }

    const window = text.slice(start, hardEnd);
    const sentenceEnd = Math.max(
      window.lastIndexOf('. '),
      window.lastIndexOf('! '),
      window.lastIndexOf('? '),
      window.lastIndexOf('\n\n'),
    );

    if (sentenceEnd > chunkSize * 0.5) {
      return start + sentenceEnd + 1;
    }

    const wordEnd = window.lastIndexOf(' ');
    return wordEnd > chunkSize * 0.5 ? start + wordEnd : hardEnd;
  }
}
