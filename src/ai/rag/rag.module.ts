import { Module } from '@nestjs/common';
import { AppLogger } from '../../common/logging/app-logger.service';
import { AiRateLimitGuard } from '../ai-rate-limit.guard';
import { GeminiService } from '../gemini.service';
import { QdrantVectorStoreService } from './qdrant-vector-store.service';
import { RagChunkerService } from './rag-chunker.service';
import { RagController } from './rag.controller';
import { RagConversationService } from './rag-conversation.service';
import { RagService } from './rag.service';

@Module({
  controllers: [RagController],
  providers: [
    RagService,
    RagChunkerService,
    RagConversationService,
    QdrantVectorStoreService,
    GeminiService,
    AiRateLimitGuard,
    AppLogger,
  ],
})
export class RagModule {}
