import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AiRateLimitGuard } from '../ai-rate-limit.guard';
import { ReindexDto } from './dto/reindex.dto';
import { RagChatDto } from './dto/rag-chat.dto';
import { RagSearchDto } from './dto/rag-search.dto';
import { RagService } from './rag.service';

@Controller('ai/rag')
@UseGuards(AiRateLimitGuard)
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Post('index')
  @HttpCode(HttpStatus.OK)
  reindex(@Body() dto: ReindexDto) {
    return this.ragService.reindex(dto);
  }

  @Post('search')
  @HttpCode(HttpStatus.OK)
  search(@Body() dto: RagSearchDto) {
    return this.ragService.search(dto);
  }

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  chat(@Body() dto: RagChatDto) {
    return this.ragService.chat(dto);
  }

  @Delete('index/articles/:articleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteArticleFromIndex(@Param('articleId') articleId: string) {
    return this.ragService.deleteArticleFromIndex(articleId);
  }

  @Get('chat/:conversationId/history')
  getHistory(@Param('conversationId') conversationId: string) {
    return this.ragService.getHistory(conversationId);
  }
}
