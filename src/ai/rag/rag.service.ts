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
import { RagIndexStateService } from './rag-index-state.service';
import { ArticleForRag, RagSearchResult } from './rag.types';
import { QdrantVectorStoreService } from './qdrant-vector-store.service';

interface DeleteArticleFromIndexOptions {
  ignoreMissing?: boolean;
}

interface SearchCandidate extends RagSearchResult {}

@Injectable()
export class RagService {
  constructor(
    private readonly db: DbService,
    private readonly gemini: GeminiService,
    private readonly chunker: RagChunkerService,
    private readonly vectorStore: QdrantVectorStoreService,
    private readonly conversations: RagConversationService,
    private readonly indexStates: RagIndexStateService,
  ) {}

  async reindex(dto: ReindexDto) {
    const onlyPublished = dto.onlyPublished ?? true;
    const currentArticles = await this.getArticlesForIndex(
      onlyPublished,
      dto.articleIds,
    );
    const requestedArticleIds = dto.articleIds ?? [];

    if (dto.incremental && !requestedArticleIds.length) {
      return this.reindexIncrementally(currentArticles);
    }

    const currentArticleIds = new Set(
      currentArticles.map((article) => article.id),
    );
    const missingRequestedIds = requestedArticleIds.filter(
      (articleId) => !currentArticleIds.has(articleId),
    );

    if (!requestedArticleIds.length) {
      return this.reindexAll(currentArticles);
    }

    return this.reindexArticleSubset(currentArticles, missingRequestedIds);
  }

  private async reindexAll(articles: ArticleForRag[]) {
    const chunks = articles.flatMap((article) =>
      this.chunker.chunkArticle(article),
    );

    if (chunks.length === 0) {
      await this.vectorStore.recreateCollection(768);
      await this.indexStates.recreateStates([]);

      return {
        indexedArticles: 0,
        indexedChunks: 0,
        deletedArticles: 0,
        mode: 'full',
        vectorCollection: getRagConfig().vectorCollection,
      };
    }

    const embeddings = await this.embedChunks(
      chunks.map((chunk) => chunk.chunk),
    );
    await this.vectorStore.recreateCollection(embeddings[0].length);
    await this.vectorStore.upsertChunks(chunks, embeddings);
    await this.indexStates.recreateStates(articles);

    return {
      indexedArticles: articles.length,
      indexedChunks: chunks.length,
      deletedArticles: 0,
      mode: 'full',
      vectorCollection: getRagConfig().vectorCollection,
    };
  }

  private async reindexArticleSubset(
    articles: ArticleForRag[],
    deletedArticleIds: string[],
  ) {
    const chunks = articles.flatMap((article) =>
      this.chunker.chunkArticle(article),
    );
    const allAffectedIds = [
      ...new Set([
        ...articles.map((article) => article.id),
        ...deletedArticleIds,
      ]),
    ];

    if (allAffectedIds.length) {
      await this.vectorStore.deleteArticles(allAffectedIds);
      await this.indexStates.deleteStates(deletedArticleIds);
    }

    if (!chunks.length) {
      return {
        indexedArticles: 0,
        indexedChunks: 0,
        deletedArticles: deletedArticleIds.length,
        mode: 'targeted',
        vectorCollection: getRagConfig().vectorCollection,
      };
    }

    const embeddings = await this.embedChunks(
      chunks.map((chunk) => chunk.chunk),
    );
    await this.vectorStore.ensureCollection(embeddings[0].length);
    await this.vectorStore.upsertChunks(chunks, embeddings);
    await this.indexStates.upsertStates(articles);

    return {
      indexedArticles: articles.length,
      indexedChunks: chunks.length,
      deletedArticles: deletedArticleIds.length,
      mode: 'targeted',
      vectorCollection: getRagConfig().vectorCollection,
    };
  }

  private async reindexIncrementally(currentArticles: ArticleForRag[]) {
    const currentById = new Map(
      currentArticles.map((article) => [article.id, article]),
    );
    const states = await this.indexStates.getStates();
    const staleStateIds = states
      .map((state) => state.articleId)
      .filter((articleId) => !currentById.has(articleId));
    const changedArticles = currentArticles.filter((article) => {
      const state = states.find(
        (candidate) => candidate.articleId === article.id,
      );

      if (!state) {
        return true;
      }

      return state.contentHash !== this.indexStates.buildContentHash(article);
    });

    const chunks = changedArticles.flatMap((article) =>
      this.chunker.chunkArticle(article),
    );
    const changedArticleIds = changedArticles.map((article) => article.id);
    const deletedArticles = [
      ...new Set([...changedArticleIds, ...staleStateIds]),
    ];

    if (!deletedArticles.length) {
      return {
        indexedArticles: 0,
        indexedChunks: 0,
        deletedArticles: 0,
        mode: 'incremental',
        vectorCollection: getRagConfig().vectorCollection,
      };
    }

    await this.vectorStore.deleteArticles(deletedArticles);
    await this.indexStates.deleteStates(staleStateIds);

    if (chunks.length) {
      const embeddings = await this.embedChunks(
        chunks.map((chunk) => chunk.chunk),
      );
      await this.vectorStore.ensureCollection(embeddings[0].length);
      await this.vectorStore.upsertChunks(chunks, embeddings);
      await this.indexStates.upsertStates(changedArticles);
    }

    return {
      indexedArticles: changedArticles.length,
      indexedChunks: chunks.length,
      deletedArticles: staleStateIds.length,
      mode: 'incremental',
      vectorCollection: getRagConfig().vectorCollection,
    };
  }

  async search(dto: RagSearchDto) {
    const limit = Math.min(dto.limit ?? 5, 20);
    const queryEmbedding = await this.gemini.embedText(dto.query);
    const semanticResults = await this.vectorStore.search(
      queryEmbedding,
      limit * 3,
      {
        articleStatus: dto.articleStatus,
        categoryId: dto.categoryId,
        tags: dto.tags,
      },
    );
    const filteredSemanticResults =
      await this.filterFreshSemanticResults(semanticResults);
    const lexicalResults = await this.searchLexically(dto, limit * 3);
    const results = this.mergeAndRerankResults(
      dto.query,
      filteredSemanticResults,
      lexicalResults,
      limit,
    );

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

  async deleteArticleFromIndex(
    articleId: string,
    options: DeleteArticleFromIndexOptions = {},
  ) {
    const deleted = await this.vectorStore.deleteArticle(articleId);
    await this.indexStates.deleteStates([articleId]);

    if (!deleted && !options.ignoreMissing) {
      throw new NotFoundException('Article vectors not found');
    }
  }

  getHistory(conversationId: string) {
    return this.conversations.getHistory(conversationId);
  }

  private async getArticlesForIndex(
    onlyPublished: boolean,
    articleIds?: string[],
    articleStatus?: 'draft' | 'published' | 'archived',
    categoryId?: string,
    tags?: string[],
  ): Promise<ArticleForRag[]> {
    const articles = await this.db.article.findMany({
      where: {
        id: articleIds?.length ? { in: articleIds } : undefined,
        status: onlyPublished
          ? ArticleStatus.PUBLISHED
          : articleStatus
            ? (articleStatus.toUpperCase() as ArticleStatus)
            : undefined,
        categoryId: categoryId ?? undefined,
        tags: tags?.length
          ? {
              some: {
                name: { in: tags },
              },
            }
          : undefined,
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
      updatedAt: article.updatedAt,
    }));
  }

  private async embedChunks(chunks: string[]) {
    const embeddings: number[][] = [];

    for (const chunk of chunks) {
      embeddings.push(await this.gemini.embedText(chunk));
    }

    return embeddings;
  }

  private async filterFreshSemanticResults(results: RagSearchResult[]) {
    if (!results.length) {
      return [];
    }

    const articleIds = [...new Set(results.map((result) => result.articleId))];
    const [articles, stateMap] = await Promise.all([
      this.getArticlesForIndex(false, articleIds),
      this.indexStates.getStateMap(articleIds),
    ]);
    const articleMap = new Map(
      articles.map((article) => [article.id, article]),
    );

    return results.filter((result) => {
      const article = articleMap.get(result.articleId);
      const state = stateMap.get(result.articleId);

      if (!article || !state) {
        return false;
      }

      return state.contentHash === this.indexStates.buildContentHash(article);
    });
  }

  private async searchLexically(dto: RagSearchDto, limit: number) {
    const articles = await this.getArticlesForIndex(
      false,
      undefined,
      dto.articleStatus,
      dto.categoryId,
      dto.tags,
    );
    const queryTerms = this.tokenize(dto.query);
    const normalizedQuery = this.normalizeText(dto.query);
    const candidates: SearchCandidate[] = [];

    for (const article of articles) {
      const chunks = this.chunker.chunkArticle(article);

      for (const chunk of chunks) {
        const lexicalScore = this.computeLexicalScore(
          normalizedQuery,
          queryTerms,
          article.title,
          chunk.chunk,
        );

        if (lexicalScore <= 0) {
          continue;
        }

        candidates.push({
          articleId: chunk.articleId,
          articleTitle: chunk.articleTitle,
          chunk: chunk.chunk,
          chunkIndex: chunk.chunkIndex,
          similarity: lexicalScore,
          lexicalScore,
          retrievalMethods: ['lexical'],
          rankingScore: lexicalScore,
        });
      }
    }

    return candidates
      .sort((left, right) => right.rankingScore - left.rankingScore)
      .slice(0, limit);
  }

  private mergeAndRerankResults(
    query: string,
    semanticResults: RagSearchResult[],
    lexicalResults: RagSearchResult[],
    limit: number,
  ) {
    const fused = new Map<string, SearchCandidate>();
    const allResults = [
      { kind: 'semantic' as const, results: semanticResults },
      { kind: 'lexical' as const, results: lexicalResults },
    ];

    for (const { kind, results } of allResults) {
      results.forEach((result, index) => {
        const key = `${result.articleId}:${result.chunkIndex}`;
        const existing = fused.get(key);
        const fusionScore = 1 / (60 + index + 1);

        if (!existing) {
          fused.set(key, {
            ...result,
            retrievalMethods: [...result.retrievalMethods],
            rankingScore: fusionScore,
          });
          return;
        }

        existing.rankingScore += fusionScore;
        existing.retrievalMethods = [
          ...new Set([...existing.retrievalMethods, kind]),
        ];
        existing.semanticScore =
          result.semanticScore ?? result.similarity ?? existing.semanticScore;
        existing.lexicalScore =
          result.lexicalScore ?? result.similarity ?? existing.lexicalScore;
      });
    }

    const reranked = [...fused.values()].map((candidate) => {
      const rerankScore = this.computeRerankScore(query, candidate);

      return {
        ...candidate,
        rerankScore,
        rankingScore: candidate.rankingScore + rerankScore,
      };
    });

    return reranked
      .sort((left, right) => right.rankingScore - left.rankingScore)
      .slice(0, limit);
  }

  private computeLexicalScore(
    normalizedQuery: string,
    queryTerms: string[],
    title: string,
    chunk: string,
  ) {
    const normalizedChunk = this.normalizeText(chunk);
    const normalizedTitle = this.normalizeText(title);
    const chunkTerms = new Set(this.tokenize(chunk));

    if (!queryTerms.length) {
      return 0;
    }

    const matchedTerms = queryTerms.filter((term) => chunkTerms.has(term));
    const coverage = matchedTerms.length / queryTerms.length;
    const exactPhraseBonus = normalizedChunk.includes(normalizedQuery) ? 2 : 0;
    const titleBonus =
      queryTerms.filter((term) => normalizedTitle.includes(term)).length * 0.4;

    return coverage * 3 + exactPhraseBonus + titleBonus;
  }

  private computeRerankScore(query: string, candidate: SearchCandidate) {
    const queryTerms = this.tokenize(query);
    const normalizedChunk = this.normalizeText(candidate.chunk);
    const normalizedTitle = this.normalizeText(candidate.articleTitle);
    const exactPhraseBonus = normalizedChunk.includes(this.normalizeText(query))
      ? 2.5
      : 0;
    const chunkCoverage =
      queryTerms.filter((term) => normalizedChunk.includes(term)).length /
      Math.max(queryTerms.length, 1);
    const titleCoverage =
      queryTerms.filter((term) => normalizedTitle.includes(term)).length /
      Math.max(queryTerms.length, 1);
    const hybridBonus = candidate.retrievalMethods.length > 1 ? 0.75 : 0;

    return exactPhraseBonus + chunkCoverage * 2 + titleCoverage + hybridBonus;
  }

  private tokenize(text: string) {
    return this.normalizeText(text)
      .split(' ')
      .filter((part) => part.length > 1);
  }

  private normalizeText(text: string) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
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
