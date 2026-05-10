import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RagChatDto {
  @IsString()
  @IsNotEmpty()
  question: string;

  @IsString()
  @IsOptional()
  conversationId?: string;
}
