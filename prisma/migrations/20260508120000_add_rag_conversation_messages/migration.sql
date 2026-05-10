CREATE TABLE "RagConversationMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RagConversationMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RagConversationMessage_conversationId_createdAt_idx" ON "RagConversationMessage"("conversationId", "createdAt");
