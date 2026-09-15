import { describe, expect, it } from "vitest";
import * as atlas from "../src/index.js";

describe("package barrel", () => {
  it("exports the public library surface", () => {
    expect(atlas.ingest).toEqual(expect.any(Function));
    expect(atlas.query).toEqual(expect.any(Function));
    expect(atlas.FALTA_EL_DATO).toBe("falta el dato");
    expect(atlas.doctorCorpus).toEqual(expect.any(Function));
    expect(atlas.formatDoctorReport).toEqual(expect.any(Function));
    expect(atlas.createOpenAICompatibleEmbeddings).toEqual(expect.any(Function));
    expect(atlas.createMockEmbeddings).toEqual(expect.any(Function));
    expect(atlas.assertEmbeddingsReady).toEqual(expect.any(Function));
    expect(atlas.embeddingsConfigFromEnv).toEqual(expect.any(Function));
    expect(atlas.embeddingsUrl).toEqual(expect.any(Function));
    expect(typeof atlas.MISSING_EMBEDDINGS_CREDENTIALS_MESSAGE).toBe("string");
    expect(atlas.MOCK_EMBEDDINGS_MODEL).toBe("atlas-mock");
    expect(atlas.cosineSimilarity).toEqual(expect.any(Function));
    expect(atlas.answerFromEvidence).toEqual(expect.any(Function));
    expect(atlas.buildGraph).toEqual(expect.any(Function));
    expect(atlas.contentHash).toEqual(expect.any(Function));
    expect(atlas.chunkMarkdown).toEqual(expect.any(Function));
    expect(atlas.loadFiches).toEqual(expect.any(Function));
    expect(atlas.parseFiche).toEqual(expect.any(Function));
    expect(atlas.findGuardrailHits).toEqual(expect.any(Function));
    expect(atlas.loadIndex).toEqual(expect.any(Function));
    expect(atlas.EDGE_TYPES).toContain("comes_from");
    expect(atlas.FICHE_KINDS).toContain("bot");
  });
});
