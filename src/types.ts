export const EDGE_TYPES = ["comes_from", "leads_to", "related", "owns"] as const;
export type EdgeType = (typeof EDGE_TYPES)[number];

export const FICHE_KINDS = ["machine", "role", "bot", "other"] as const;
export type FicheKind = (typeof FICHE_KINDS)[number];

export interface GraphEdge {
  from: string;
  to: string;
  type: EdgeType;
}

export interface FicheEdgeRef {
  to: string;
  type: EdgeType;
}

export interface Fiche {
  id: string;
  kind: FicheKind;
  title: string;
  path: string;
  body: string;
  raw: string;
  content_hash: string;
  edges: FicheEdgeRef[];
}

export interface DocGraph {
  nodes: string[];
  edges: GraphEdge[];
}

export interface Chunk {
  id: string;
  ficheId: string;
  heading: string;
  text: string;
  content_hash: string;
}

export interface IndexedChunk extends Chunk {
  embedding: number[];
}

export interface IndexFicheMeta {
  content_hash: string;
  path: string;
  kind: FicheKind;
  title: string;
}

export interface AtlasIndex {
  version: 1;
  model: string;
  updatedAt: string;
  fiches: Record<string, IndexFicheMeta>;
  graph: DocGraph;
  chunks: IndexedChunk[];
}

export interface QueryHit {
  ficheId: string;
  heading: string;
  score: number;
  text: string;
}

export interface QueryResult {
  answer: string;
  sources: QueryHit[];
  neighbors: string[];
}

export interface IngestResult {
  ficheCount: number;
  chunkCount: number;
  embedded: number;
  reused: number;
  indexPath: string;
  navPath: string;
}

export const FALTA_EL_DATO = "falta el dato";

export function isEdgeType(value: string): value is EdgeType {
  return (EDGE_TYPES as readonly string[]).includes(value);
}

export function isFicheKind(value: string): value is FicheKind {
  return (FICHE_KINDS as readonly string[]).includes(value);
}
