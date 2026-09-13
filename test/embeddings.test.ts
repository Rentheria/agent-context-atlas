import { describe, expect, it } from "vitest";
import {
  createOpenAICompatibleEmbeddings,
  embeddingsConfigFromEnv,
  embeddingsUrl,
} from "../src/embeddings.js";
import { mockEmbeddingsFetch } from "./helpers.js";

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
});
