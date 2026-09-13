import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FALTA_EL_DATO } from "../src/types.js";
import { createOpenAICompatibleEmbeddings } from "../src/embeddings.js";
import { ingest } from "../src/ingest.js";
import { query } from "../src/query.js";
import { fakeEmbeddingsClient, mockEmbeddingsFetch } from "./helpers.js";

const fixtures = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fixtures");

async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "atlas-"));
  try {
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe("ingest + query", () => {
  it("re-embeds only when content_hash changes", async () => {
    await withTempDir(async (dir) => {
      const calls: { url: string; body: unknown }[] = [];
      const embeddings = createOpenAICompatibleEmbeddings({
        baseUrl: "http://localhost:9/v1",
        model: "test-embed",
        fetchImpl: mockEmbeddingsFetch(calls) as typeof fetch,
      });

      const first = await ingest({
        fichesDir: path.join(fixtures, "fiches"),
        graphPath: path.join(fixtures, "graph.json"),
        indexDir: dir,
        embeddings,
      });
      expect(first.embedded).toBeGreaterThan(0);
      expect(first.reused).toBe(0);
      const firstCalls = calls.length;

      const second = await ingest({
        fichesDir: path.join(fixtures, "fiches"),
        graphPath: path.join(fixtures, "graph.json"),
        indexDir: dir,
        embeddings,
      });
      expect(second.embedded).toBe(0);
      expect(second.reused).toBe(first.chunkCount);
      expect(calls.length).toBe(firstCalls);

      const changedDir = path.join(dir, "changed-fiches");
      await mkdir(changedDir, { recursive: true });
      const { cp } = await import("node:fs/promises");
      await cp(path.join(fixtures, "fiches"), changedDir, { recursive: true });
      await writeFile(
        path.join(changedDir, "host-demo-01.md"),
        `---
id: host-demo-01
kind: machine
title: Host de demostración 01
---

# host-demo-01

RAM_GB: 4

Nueva nota sintética: org-example-revision.
`,
        "utf8",
      );

      const third = await ingest({
        fichesDir: changedDir,
        graphPath: path.join(fixtures, "graph.json"),
        indexDir: dir,
        embeddings,
      });
      expect(third.embedded).toBeGreaterThan(0);
      expect(third.reused).toBeLessThan(third.chunkCount);
    });
  });

  it("returns grounded metrics and expands graph neighbors", async () => {
    await withTempDir(async (dir) => {
      const embeddings = fakeEmbeddingsClient();
      await ingest({
        fichesDir: path.join(fixtures, "fiches"),
        graphPath: path.join(fixtures, "graph.json"),
        indexDir: dir,
        embeddings,
      });

      const ram = await query({
        question: "RAM_GB de host-demo-01",
        indexDir: dir,
        embeddings,
      });
      expect(ram.answer).toMatch(/RAM_GB/);
      expect(ram.answer).toMatch(/4/);
      expect(ram.answer).not.toBe(FALTA_EL_DATO);
      expect(ram.sources.some((source) => source.ficheId === "host-demo-01")).toBe(true);
      expect(ram.neighbors.length).toBeGreaterThan(0);
      const closed = new Set([...ram.neighbors, ...ram.sources.map((source) => source.ficheId)]);
      expect([...closed]).toEqual(
        expect.arrayContaining(["host-demo-01", "bot-alpha"]),
      );

      const tokens = await query({
        question: "max_context_tokens of bot-alpha",
        indexDir: dir,
        embeddings,
      });
      expect(tokens.answer).toMatch(/8192/);
    });
  });

  it("answers falta el dato when a metric is not in the corpus", async () => {
    await withTempDir(async (dir) => {
      const embeddings = fakeEmbeddingsClient();
      await ingest({
        fichesDir: path.join(fixtures, "fiches"),
        graphPath: path.join(fixtures, "graph.json"),
        indexDir: dir,
        embeddings,
      });

      const latency = await query({
        question: "What is the latency of bot-alpha?",
        indexDir: dir,
        embeddings,
      });
      expect(latency.answer).toBe(FALTA_EL_DATO);

      const gpu = await query({
        question: "cuántas GPU tiene host-demo-01",
        indexDir: dir,
        embeddings,
      });
      expect(gpu.answer).toBe(FALTA_EL_DATO);
    });
  });
});
