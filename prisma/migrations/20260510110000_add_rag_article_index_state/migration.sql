CREATE TABLE "RagArticleIndexState" (
    "articleId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "articleStatus" TEXT NOT NULL,
    "articleUpdatedAt" TIMESTAMP(3) NOT NULL,
    "indexedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RagArticleIndexState_pkey" PRIMARY KEY ("articleId")
);

CREATE INDEX "RagArticleIndexState_articleStatus_idx" ON "RagArticleIndexState"("articleStatus");
CREATE INDEX "RagArticleIndexState_indexedAt_idx" ON "RagArticleIndexState"("indexedAt");
