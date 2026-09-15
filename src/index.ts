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
  renderGraphMarkdown,
  renderGraphMermaid,
} from "./graph.js";
export {
  createOpenAICompatibleEmbeddings,
  embeddingsConfigFromEnv,
  embeddingsUrl,
} from "./embeddings.js";
export type { EmbeddingsClient, EmbeddingsConfig } from "./embeddings.js";
export { ingest } from "./ingest.js";
export { query, cosineSimilarity } from "./query.js";
export { answerFromEvidence, entityIdsIn, hasMeasurementIntent } from "./answer.js";
export { loadIndex } from "./store.js";
