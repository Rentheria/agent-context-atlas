export { FALTA_EL_DATO, EDGE_TYPES, FICHE_KINDS } from "./types.js";
export type {
  AtlasIndex,
  Chunk,
  DocGraph,
  EdgeType,
  Fiche,
  FicheKind,
  GraphEdge,
  IndexedChunk,
  IngestResult,
  QueryHit,
  QueryResult,
} from "./types.js";

export { contentHash } from "./hash.js";
export { chunkMarkdown } from "./chunker.js";
export { loadFiches, parseFiche } from "./fiche.js";
export {
  buildGraph,
  expandNeighbors,
  loadGraphFile,
  mermaidNodeId,
  renderGraphDot,
  renderGraphMarkdown,
  renderGraphMermaid,
} from "./graph.js";
export { doctorCorpus, formatDoctorReport } from "./doctor.js";
export type { DoctorOptions, DoctorReport } from "./doctor.js";
export { findGuardrailHits } from "./guardrails.js";
export type { GuardrailHit } from "./guardrails.js";
export {
  assertEmbeddingsReady,
  createMockEmbeddings,
  createOpenAICompatibleEmbeddings,
  DEFAULT_EMBEDDINGS_BASE_URL,
  embeddingsConfigFromEnv,
  embeddingsNeedCloudApiKey,
  embeddingsUrl,
  isLocalEmbeddingsBaseUrl,
  MISSING_EMBEDDINGS_CREDENTIALS_MESSAGE,
  MOCK_EMBEDDINGS_MODEL,
  mockEmbeddingVector,
} from "./embeddings.js";
export type { EmbeddingsClient, EmbeddingsConfig } from "./embeddings.js";
export { ingest } from "./ingest.js";
export { query, cosineSimilarity } from "./query.js";
export { answerFromEvidence, entityIdsIn, hasMeasurementIntent } from "./answer.js";
export { loadIndex } from "./store.js";
