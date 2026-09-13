import type { EmbeddingsClient } from "./embeddings.js";
import { expandNeighbors } from "./graph.js";
import { FALTA_EL_DATO, type IndexedChunk, type QueryHit, type QueryResult } from "./types.js";
import { loadIndex } from "./store.js";
import { answerFromEvidence, isMetricToken, tokenize } from "./answer.js";

export interface QueryOptions {
  question: string;
  indexDir: string;
  embeddings: EmbeddingsClient;
  topK?: number;
  seedFiches?: number;
  expandHops?: number;
}

export async function query(options: QueryOptions): Promise<QueryResult> {
  const question = options.question.trim();
  if (!question) {
    return { answer: FALTA_EL_DATO, sources: [], neighbors: [] };
  }

  const index = await loadIndex(options.indexDir);
  if (!index || index.chunks.length === 0) {
    return { answer: FALTA_EL_DATO, sources: [], neighbors: [] };
  }
  if (index.model !== options.embeddings.model) {
    throw new Error(
      `Index model ${index.model} does not match embeddings model ${options.embeddings.model}. Re-run ingest.`,
    );
  }

  const [questionVector] = await options.embeddings.embed([question]);
  if (!questionVector) {
    throw new Error("Embeddings endpoint returned no vector for the query");
  }

  const topK = options.topK ?? 5;
  const ranked = rankChunks(index.chunks, questionVector, question);
  const seeds = unique(ranked.slice(0, topK).map((hit) => hit.ficheId)).slice(
    0,
    options.seedFiches ?? 2,
  );
  const neighbors = expandNeighbors(index.graph, seeds, options.expandHops ?? 1);
  const neighborSet = new Set(neighbors);

  const neighborHits = rankChunks(
    index.chunks.filter((chunk) => neighborSet.has(chunk.ficheId)),
    questionVector,
    question,
  ).slice(0, topK);

  const sources = dedupeHits([...ranked.slice(0, topK), ...neighborHits]).slice(0, topK + neighborHits.length);
  const evidence = sources.map((hit) => hit.text).join("\n\n");
  const answer = answerFromEvidence(question, evidence);

  return { answer, sources, neighbors };
}

function rankChunks(chunks: IndexedChunk[], queryVector: number[], question: string): QueryHit[] {
  return chunks
    .map((chunk) => ({
      ficheId: chunk.ficheId,
      heading: chunk.heading,
      text: chunk.text,
      score: cosineSimilarity(queryVector, chunk.embedding) + lexicalBonus(question, chunk.text),
    }))
    .sort((a, b) => b.score - a.score);
}

function lexicalBonus(question: string, text: string): number {
  const qTokens = tokenize(question);
  const tTokens = tokenize(text);
  let bonus = 0;
  for (const token of qTokens) {
    if (!tTokens.has(token)) continue;
    bonus += isMetricToken(token) ? 2 : 0.05;
  }
  return bonus;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i += 1) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot += av * bv;
    na += av * av;
    nb += bv * bv;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

function unique(ids: string[]): string[] {
  return [...new Set(ids)];
}

function dedupeHits(hits: QueryHit[]): QueryHit[] {
  const seen = new Set<string>();
  const out: QueryHit[] = [];
  for (const hit of hits) {
    const key = `${hit.ficheId}:${hit.heading}:${hit.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(hit);
  }
  return out;
}
