import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DbService } from '../../db/db.service';
import { getRagConfig } from './rag-config';

@Injectable()
export class RagConversationService {
  constructor(private readonly db: DbService) {}

  createConversationId() {
    return uuidv4();
  }

  async addMessage(
    conversationId: string,
    role: 'user' | 'assistant',
    content: string,
  ) {
    await this.db.ragConversationMessage.create({
      data: {
        conversationId,
        role,
        content,
      },
    });

    await this.trimConversation(conversationId);
  }

  async getHistory(conversationId: string) {
    return this.db.ragConversationMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        conversationId: true,
        role: true,
        content: true,
        createdAt: true,
      },
    });
  }

  private async trimConversation(conversationId: string) {
    const maxMessages = getRagConfig().maxConversationMessages;
    const messages = await this.db.ragConversationMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      skip: maxMessages,
      select: { id: true },
    });

    if (!messages.length) {
      return;
    }

    await this.db.ragConversationMessage.deleteMany({
      where: {
        id: {
          in: messages.map((message) => message.id),
        },
      },
    });
  }
}
