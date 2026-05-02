import { Injectable } from '@nestjs/common';
import { ArticleService } from '../article/article.service';
import { AnalyzeTask } from './dto/analyze-article.dto';
import { GenerateDto } from './dto/generate.dto';
import { SummaryLength } from './dto/summarize-article.dto';
import { TranslateArticleDto } from './dto/translate-article.dto';
import { GeminiService } from './gemini.service';
import {
  buildAnalyzeArticlePrompt,
  buildSummarizeArticlePrompt,
  buildTranslateArticlePrompt,
} from './prompts/article-prompts';
import { buildGenericPrompt } from './prompts/generic-prompts';
import { AiCacheService } from './ai-cache.service';
import { AiUsageService } from './ai-usage.service';
import {
  AnalyzeArticleResponse,
  Severity,
  SummarizeArticleResponse,
  TranslateArticleResponse,
} from './types/article-ai-response.types';

interface ArticleForAi {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
}

@Injectable()
export class AiService {
  constructor(
    private readonly articleService: ArticleService,
    private readonly geminiService: GeminiService,
    private readonly cache: AiCacheService,
    private readonly usage: AiUsageService,
  ) {}

  async summarizeArticle(
    articleId: string,
    maxLength = SummaryLength.MEDIUM,
  ): Promise<SummarizeArticleResponse> {
    this.usage.record('summarizeArticle');

    const article = (await this.articleService.getById(
      articleId,
    )) as ArticleForAi;
    const cacheKey = this.cache.buildArticleKey(
      'summarize',
      articleId,
      article.updatedAt,
      { maxLength },
    );
    const cached = this.cache.get<SummarizeArticleResponse>(cacheKey);

    if (cached) {
      return cached;
    }

    const generation = await this.geminiService.generateText(
      buildSummarizeArticlePrompt(article, maxLength),
    );
    this.recordTokens(generation.totalTokens);

    const result = {
      articleId,
      summary: generation.text,
      originalLength: article.content.length,
      summaryLength: generation.text.length,
    };

    this.cache.set(cacheKey, result);
    return result;
  }

  async translateArticle(
    articleId: string,
    dto: TranslateArticleDto,
  ): Promise<TranslateArticleResponse> {
    this.usage.record('translateArticle');

    const article = (await this.articleService.getById(
      articleId,
    )) as ArticleForAi;
    const params = {
      targetLanguage: dto.targetLanguage,
      sourceLanguage: dto.sourceLanguage ?? null,
    };
    const cacheKey = this.cache.buildArticleKey(
      'translate',
      articleId,
      article.updatedAt,
      params,
    );
    const cached = this.cache.get<TranslateArticleResponse>(cacheKey);

    if (cached) {
      return cached;
    }

    const generation = await this.geminiService.generateText(
      buildTranslateArticlePrompt(
        article,
        dto.targetLanguage,
        dto.sourceLanguage,
      ),
    );
    this.recordTokens(generation.totalTokens);

    const parsed = this.parseJson<{
      translatedText?: string;
      detectedLanguage?: string;
    }>(generation.text);
    const result = {
      articleId,
      translatedText: parsed?.translatedText?.trim() || generation.text,
      detectedLanguage:
        parsed?.detectedLanguage?.trim() || dto.sourceLanguage || 'unknown',
    };

    this.cache.set(cacheKey, result);
    return result;
  }

  async analyzeArticle(
    articleId: string,
    task = AnalyzeTask.REVIEW,
  ): Promise<AnalyzeArticleResponse> {
    this.usage.record('analyzeArticle');

    const article = (await this.articleService.getById(
      articleId,
    )) as ArticleForAi;
    const generation = await this.geminiService.generateText(
      buildAnalyzeArticlePrompt(article, task),
    );
    this.recordTokens(generation.totalTokens);

    const parsed = this.parseJson<{
      analysis?: string;
      suggestions?: string[];
      severity?: Severity;
    }>(generation.text);

    return {
      articleId,
      analysis: parsed?.analysis?.trim() || generation.text,
      suggestions: Array.isArray(parsed?.suggestions)
        ? parsed.suggestions.filter(
            (suggestion) => typeof suggestion === 'string',
          )
        : [],
      severity: this.normalizeSeverity(parsed?.severity),
    };
  }

  async generate(dto: GenerateDto) {
    this.usage.record('generate');
    const generation = await this.geminiService.generateText(
      buildGenericPrompt(dto.prompt, dto.systemInstruction),
    );
    this.recordTokens(generation.totalTokens);

    return {
      text: generation.text,
    };
  }

  getUsage() {
    return this.usage.getSnapshot();
  }

  private parseJson<T>(text: string): T | undefined {
    const withoutFence = text
      .trim()
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/, '')
      .trim();
    const jsonText = withoutFence.match(/\{[\s\S]*\}/)?.[0] ?? withoutFence;

    try {
      return JSON.parse(jsonText) as T;
    } catch {
      return undefined;
    }
  }

  private normalizeSeverity(severity: unknown): Severity {
    if (severity === 'warning' || severity === 'error') {
      return severity;
    }

    return 'info';
  }

  private recordTokens(totalTokens?: number) {
    this.usage.addTokens(totalTokens);
  }
}
