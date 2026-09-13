import { chunkMarkdown } from "./chunker.js";
import type { EmbeddingsClient } from "./embeddings.js";
import { loadFiches } from "./fiche.js";
import { buildGraph, loadGraphFile, renderGraphMarkdown } from "./graph.js";
import { loadIndex, saveIndex, saveNav } from "./store.js";
import type {
  AtlasIndex,
  Chunk,
  Fiche,
  GraphEdge,
  IndexedChunk,
  IndexFicheMeta,
  IngestResult,
} from "./types.js";

export interface IngestOptions {
  fichesDir: string;
  graphPath?: string;
  indexDir: string;
  embeddings: EmbeddingsClient;
}

export async function ingest(options: IngestOptions): Promise<IngestResult> {
  const fiches = await loadFiches(options.fichesDir);
  if (fiches.length === 0) {
    throw new Error(`No markdown fiches found in ${options.fichesDir}`);
  }

  const extraEdges: GraphEdge[] = options.graphPath ? await loadGraphFile(options.graphPath) : [];
  const graph = buildGraph(fiches, extraEdges);
  const previous = await loadIndex(options.indexDir);
  const sameModel = previous?.model === options.embeddings.model;

  const reusable = new Map<string, IndexedChunk>();
  if (sameModel && previous) {
    for (const chunk of previous.chunks) {
      reusable.set(chunk.content_hash, chunk);
    }
  }

  const planned: Chunk[] = [];
  const ficheMeta: Record<string, IndexFicheMeta> = {};

  for (const fiche of fiches) {
    ficheMeta[fiche.id] = {
      content_hash: fiche.content_hash,
      path: fiche.path,
      kind: fiche.kind,
      title: fiche.title,
    };
    planned.push(...chunksForFiche(fiche, previous, sameModel));
  }

  const toEmbed: Chunk[] = [];
  const nextChunks: IndexedChunk[] = [];
  let reused = 0;

  for (const chunk of planned) {
    const cached = reusable.get(chunk.content_hash);
    if (cached) {
      nextChunks.push({ ...chunk, embedding: cached.embedding });
      reused += 1;
    } else {
      toEmbed.push(chunk);
    }
  }

  if (toEmbed.length > 0) {
    const vectors = await options.embeddings.embed(toEmbed.map((chunk) => chunk.text));
    for (const [i, chunk] of toEmbed.entries()) {
      const embedding = vectors[i];
      if (!embedding) {
        throw new Error(`Missing embedding for chunk ${chunk.id}`);
      }
      nextChunks.push({ ...chunk, embedding });
    }
  }

  const index: AtlasIndex = {
    version: 1,
    model: options.embeddings.model,
    updatedAt: new Date().toISOString(),
    fiches: ficheMeta,
    graph,
    chunks: nextChunks,
  };

  const indexPath = await saveIndex(options.indexDir, index);
  const titles = Object.fromEntries(fiches.map((fiche) => [fiche.id, fiche.title]));
  const navPath = await saveNav(options.indexDir, renderGraphMarkdown(graph, titles));

  return {
    ficheCount: fiches.length,
    chunkCount: nextChunks.length,
    embedded: toEmbed.length,
    reused,
    indexPath,
    navPath,
  };
}

function chunksForFiche(fiche: Fiche, previous: AtlasIndex | null, sameModel: boolean): Chunk[] {
  if (
    sameModel &&
    previous &&
    previous.fiches[fiche.id]?.content_hash === fiche.content_hash
  ) {
    return previous.chunks
      .filter((chunk) => chunk.ficheId === fiche.id)
      .map(({ embedding: _embedding, ...chunk }) => chunk);
  }
  return chunkMarkdown(fiche.id, fiche.body);
}
