import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AiRateLimitGuard } from './ai-rate-limit.guard';
import { AiService } from './ai.service';
import { AnalyzeArticleDto, AnalyzeTask } from './dto/analyze-article.dto';
import { ArticleParamDto } from './dto/article-param.dto';
import { GenerateDto } from './dto/generate.dto';
import {
  SummarizeArticleDto,
  SummaryLength,
} from './dto/summarize-article.dto';
import { TranslateArticleDto } from './dto/translate-article.dto';

@Controller('ai')
@UseGuards(AiRateLimitGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('articles/:articleId/summarize')
  summarizeArticle(
    @Param() params: ArticleParamDto,
    @Body() dto: SummarizeArticleDto,
  ) {
    return this.aiService.summarizeArticle(
      params.articleId,
      dto.maxLength ?? SummaryLength.MEDIUM,
    );
  }

  @Post('articles/:articleId/translate')
  translateArticle(
    @Param() params: ArticleParamDto,
    @Body() dto: TranslateArticleDto,
  ) {
    return this.aiService.translateArticle(params.articleId, dto);
  }

  @Post('articles/:articleId/analyze')
  analyzeArticle(
    @Param() params: ArticleParamDto,
    @Body() dto: AnalyzeArticleDto,
  ) {
    return this.aiService.analyzeArticle(
      params.articleId,
      dto.task ?? AnalyzeTask.REVIEW,
    );
  }

  @Post('generate')
  generate(@Body() dto: GenerateDto) {
    return this.aiService.generate(dto);
  }

  @Get('usage')
  getUsage() {
    return this.aiService.getUsage();
  }
}
