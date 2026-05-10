export function getRagConfig() {
  return {
    vectorDbProvider: process.env.RAG_VECTOR_DB_PROVIDER ?? 'qdrant',
    vectorDbUrl: process.env.RAG_VECTOR_DB_URL ?? 'http://vectordb:6333',
    vectorCollection:
      process.env.RAG_VECTOR_COLLECTION ?? 'knowledge_hub_articles',
    chunkSize: getPositiveInteger(process.env.RAG_CHUNK_SIZE, 800),
    chunkOverlap: getNonNegativeInteger(process.env.RAG_CHUNK_OVERLAP, 200),
    maxConversationMessages: getPositiveInteger(
      process.env.RAG_CONVERSATION_MAX_MESSAGES,
      20,
    ),
  };
}

function getPositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getNonNegativeInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
