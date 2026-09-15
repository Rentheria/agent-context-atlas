import { describe, expect, it } from "vitest";
import {
  createOpenAICompatibleEmbeddings,
  EMBEDDINGS_MAX_RETRIES,
  EMBEDDINGS_RETRY_BACKOFF_MS,
  embeddingsConfigFromEnv,
  embeddingsUrl,
  formatEmbeddingsHttpError,
} from "../src/embeddings.js";
import { fakeEmbedding, mockEmbeddingsFetch } from "./helpers.js";

describe("embeddings client", () => {
  it("POSTs to an OpenAI-compatible /v1/embeddings URL", async () => {
    const calls: { url: string; body: unknown }[] = [];
    const client = createOpenAICompatibleEmbeddings({
      baseUrl: "http://localhost:11434/v1",
      model: "nomic-embed-text",
      apiKey: "test-key",
      fetchImpl: mockEmbeddingsFetch(calls) as typeof fetch,
    });

    const vectors = await client.embed(["hello atlas", "bot-alpha"]);
    expect(vectors).toHaveLength(2);
    expect(vectors[0]?.length).toBeGreaterThan(0);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("http://localhost:11434/v1/embeddings");
    expect(calls[0]?.body).toEqual({
      model: "nomic-embed-text",
      input: ["hello atlas", "bot-alpha"],
    });
  });

  it("reads config from env and never requires a key in the repo", () => {
    const config = embeddingsConfigFromEnv({
      ATLAS_EMBEDDINGS_BASE_URL: "https://example.test/v1",
      ATLAS_EMBEDDINGS_MODEL: "demo-embed",
    });
    expect(config.baseUrl).toBe("https://example.test/v1");
    expect(config.model).toBe("demo-embed");
    expect(config.apiKey).toBeUndefined();
    expect(embeddingsUrl("https://api.openai.com/v1")).toBe("https://api.openai.com/v1/embeddings");
  });

  it("retries HTTP 429 then succeeds (initial + up to 2 retries)", async () => {
    const statuses: number[] = [];
    const delays: number[] = [];
    const client = createOpenAICompatibleEmbeddings({
      baseUrl: "http://localhost:11434/v1",
      model: "nomic-embed-text",
      sleep: async (ms) => {
        delays.push(ms);
      },
      fetchImpl: (async () => {
        const attempt = statuses.length;
        if (attempt === 0) {
          statuses.push(429);
          return new Response("rate limited", { status: 429, statusText: "Too Many Requests" });
        }
        statuses.push(200);
        return new Response(
          JSON.stringify({
            data: [{ embedding: fakeEmbedding("hello"), index: 0 }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }) as typeof fetch,
    });

    const vectors = await client.embed(["hello"]);
    expect(vectors).toHaveLength(1);
    expect(statuses).toEqual([429, 200]);
    expect(delays).toEqual([EMBEDDINGS_RETRY_BACKOFF_MS[0]]);
    expect(EMBEDDINGS_MAX_RETRIES).toBe(2);
  });

  it("retries HTTP 5xx up to two times and then succeeds", async () => {
    const statuses: number[] = [];
    const delays: number[] = [];
    const client = createOpenAICompatibleEmbeddings({
      baseUrl: "http://localhost:11434/v1",
      model: "nomic-embed-text",
      sleep: async (ms) => {
        delays.push(ms);
      },
      fetchImpl: (async () => {
        if (statuses.length < 2) {
          statuses.push(503);
          return new Response("unavailable", { status: 503, statusText: "Service Unavailable" });
        }
        statuses.push(200);
        return new Response(
          JSON.stringify({
            data: [{ embedding: fakeEmbedding("hello"), index: 0 }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }) as typeof fetch,
    });

    await expect(client.embed(["hello"])).resolves.toHaveLength(1);
    expect(statuses).toEqual([503, 503, 200]);
    expect(delays).toEqual([...EMBEDDINGS_RETRY_BACKOFF_MS]);
  });

  it("gives up after the initial attempt plus two 5xx retries", async () => {
    let calls = 0;
    const delays: number[] = [];
    const client = createOpenAICompatibleEmbeddings({
      baseUrl: "http://localhost:11434/v1",
      model: "nomic-embed-text",
      sleep: async (ms) => {
        delays.push(ms);
      },
      fetchImpl: (async () => {
        calls += 1;
        return new Response("down", { status: 500, statusText: "Internal Server Error" });
      }) as typeof fetch,
    });

    await expect(client.embed(["hello"])).rejects.toThrow(/Embeddings HTTP 500 Internal Server Error/);
    expect(calls).toBe(1 + EMBEDDINGS_MAX_RETRIES);
    expect(delays).toEqual([...EMBEDDINGS_RETRY_BACKOFF_MS]);
  });

  it("does not retry non-429 4xx", async () => {
    let calls = 0;
    const client = createOpenAICompatibleEmbeddings({
      baseUrl: "http://localhost:11434/v1",
      model: "nomic-embed-text",
      sleep: async () => {
        throw new Error("backoff should not run for 400");
      },
      fetchImpl: (async () => {
        calls += 1;
        return new Response("bad request", { status: 400, statusText: "Bad Request" });
      }) as typeof fetch,
    });

    await expect(client.embed(["hello"])).rejects.toThrow(/Embeddings HTTP 400 Bad Request/);
    expect(calls).toBe(1);
  });

  it("omits a double space when statusText is empty", () => {
    expect(formatEmbeddingsHttpError(502, "", "oops")).toBe("Embeddings HTTP 502: oops");
    expect(formatEmbeddingsHttpError(429, "  ", "slow")).toBe("Embeddings HTTP 429: slow");
    expect(formatEmbeddingsHttpError(500, "Internal Server Error", "x")).toBe(
      "Embeddings HTTP 500 Internal Server Error: x",
    );
  });
});
