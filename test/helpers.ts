import type { EmbeddingsClient } from "../src/embeddings.js";
import { createMockEmbeddings, mockEmbeddingVector } from "../src/embeddings.js";

/** Deterministic bag-of-words vector so tests never need a live embeddings HTTP server. */
export function fakeEmbedding(text: string, dim = 32): number[] {
  return mockEmbeddingVector(text, dim);
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
  return createMockEmbeddings(model);
}
