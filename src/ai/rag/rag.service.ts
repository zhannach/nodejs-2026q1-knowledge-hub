import { Injectable, NotFoundException } from '@nestjs/common';
import { ArticleStatus } from '@prisma/client';
import { DbService } from '../../db/db.service';
import { GeminiService } from '../gemini.service';
import { ReindexDto } from './dto/reindex.dto';
import { RagChatDto } from './dto/rag-chat.dto';
import { RagSearchDto } from './dto/rag-search.dto';
import { getRagConfig } from './rag-config';
import { RagChunkerService } from './rag-chunker.service';
import { RagConversationService } from './rag-conversation.service';
import { ArticleForRag, RagSearchResult } from './rag.types';
import { QdrantVectorStoreService } from './qdrant-vector-store.service';

@Injectable()
export class RagService {
  constructor(
    private readonly db: DbService,
    private readonly gemini: GeminiService,
    private readonly chunker: RagChunkerService,
    private readonly vectorStore: QdrantVectorStoreService,
    private readonly conversations: RagConversationService,
  ) {}

  async reindex(dto: ReindexDto) {
    const onlyPublished = dto.onlyPublished ?? true;
    const articles = await this.getArticlesForIndex(
      onlyPublished,
      dto.articleIds,
    );
    const chunks = articles.flatMap((article) =>
      this.chunker.chunkArticle(article),
    );

    if (chunks.length === 0) {
      if (!dto.articleIds?.length) {
        await this.vectorStore.recreateCollection(768);
      }

      return {
        indexedArticles: articles.length,
        indexedChunks: 0,
        vectorCollection: getRagConfig().vectorCollection,
      };
    }

    const embeddings: number[][] = [];

    for (const chunk of chunks) {
      embeddings.push(await this.gemini.embedText(chunk.chunk));
    }

    if (dto.articleIds?.length) {
      await this.vectorStore.ensureCollection(embeddings[0].length);
      await this.vectorStore.deleteArticles(dto.articleIds);
    } else {
      await this.vectorStore.recreateCollection(embeddings[0].length);
    }

    await this.vectorStore.upsertChunks(chunks, embeddings);

    return {
      indexedArticles: articles.length,
      indexedChunks: chunks.length,
      vectorCollection: getRagConfig().vectorCollection,
    };
  }

  async search(dto: RagSearchDto) {
    const limit = Math.min(dto.limit ?? 5, 20);
    const queryEmbedding = await this.gemini.embedText(dto.query);
    const results = await this.vectorStore.search(queryEmbedding, limit, {
      articleStatus: dto.articleStatus,
      categoryId: dto.categoryId,
      tags: dto.tags,
    });

    return { results };
  }

  async chat(dto: RagChatDto) {
    const conversationId =
      dto.conversationId || this.conversations.createConversationId();
    const searchResults = await this.search({
      query: dto.question,
      limit: 5,
      articleStatus: 'published',
    });
    const history = await this.conversations.getHistory(conversationId);
    const prompt = this.buildGroundedPrompt(
      dto.question,
      history.slice(-getRagConfig().maxConversationMessages),
      searchResults.results,
    );
    const generation = await this.gemini.generateText(prompt);

    await this.conversations.addMessage(conversationId, 'user', dto.question);
    await this.conversations.addMessage(
      conversationId,
      'assistant',
      generation.text,
    );

    return {
      answer: generation.text,
      sources: searchResults.results.map((result) => ({
        articleId: result.articleId,
        articleTitle: result.articleTitle,
        relevantChunk: result.chunk,
      })),
      conversationId,
    };
  }

  async deleteArticleFromIndex(articleId: string) {
    const deleted = await this.vectorStore.deleteArticle(articleId);

    if (!deleted) {
      throw new NotFoundException('Article vectors not found');
    }
  }

  getHistory(conversationId: string) {
    return this.conversations.getHistory(conversationId);
  }

  private async getArticlesForIndex(
    onlyPublished: boolean,
    articleIds?: string[],
  ): Promise<ArticleForRag[]> {
    const articles = await this.db.article.findMany({
      where: {
        id: articleIds?.length ? { in: articleIds } : undefined,
        status: onlyPublished ? ArticleStatus.PUBLISHED : undefined,
      },
      include: {
        tags: true,
      },
      orderBy: {
        id: 'asc',
      },
    });

    return articles.map((article) => ({
      id: article.id,
      title: article.title,
      content: article.content,
      status: article.status.toLowerCase(),
      categoryId: article.categoryId,
      tags: article.tags,
    }));
  }

  private buildGroundedPrompt(
    question: string,
    history: Array<{ role: string; content: string }>,
    results: RagSearchResult[],
  ) {
    const sourceBlock = results.length
      ? results
          .map(
            (result, index) =>
              `[${index + 1}] Article: ${result.articleTitle}\nArticle ID: ${result.articleId}\nChunk:\n${result.chunk}`,
          )
          .join('\n\n')
      : 'No relevant indexed Knowledge Hub chunks were retrieved.';
    const historyBlock = history.length
      ? history
          .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
          .join('\n')
      : 'No prior conversation.';

    return [
      'You are the Knowledge Hub RAG assistant.',
      'Answer the user using only the provided Knowledge Hub sources.',
      'If the sources do not contain the answer, say that the Knowledge Hub does not contain enough information.',
      'Do not invent article IDs, titles, facts, or citations.',
      '',
      'Conversation history:',
      historyBlock,
      '',
      'Sources:',
      sourceBlock,
      '',
      `Question: ${question}`,
      '',
      'Grounded answer:',
    ].join('\n');
  }
}
