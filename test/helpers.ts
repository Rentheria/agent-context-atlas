import type { EmbeddingsClient } from "../src/embeddings.js";

/** Deterministic bag-of-words vector so tests never need a live embeddings HTTP server. */
export function fakeEmbedding(text: string, dim = 32): number[] {
  const vec = new Array<number>(dim).fill(0);
  const tokens = text.toLowerCase().split(/\W+/).filter(Boolean);
  for (const token of tokens) {
    let hash = 0;
    for (let i = 0; i < token.length; i += 1) {
      hash = (hash * 31 + token.charCodeAt(i)) >>> 0;
    }
    const index = hash % dim;
    vec[index] = (vec[index] ?? 0) + 1;
  }
  let norm = 0;
  for (const value of vec) norm += value * value;
  norm = Math.sqrt(norm);
  if (norm === 0) return vec;
  return vec.map((value) => value / norm);
}

export function mockEmbeddingsFetch(calls: { url: string; body: unknown }[] = []) {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    calls.push({ url, body });
    const texts: string[] = Array.isArray(body.input) ? body.input : [String(body.input ?? "")];
    return new Response(
      JSON.stringify({
        data: texts.map((text, index) => ({
          embedding: fakeEmbedding(text),
          index,
        })),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };
}

export function fakeEmbeddingsClient(model = "test-embed"): EmbeddingsClient {
  return {
    model,
    async embed(texts: string[]) {
      return texts.map((text) => fakeEmbedding(text));
    },
  };
}
