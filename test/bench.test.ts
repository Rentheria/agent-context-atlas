import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  benchQuestions,
  formatBenchReport,
  percentile,
  runBench,
  runBenchCli,
  writeSyntheticCorpus,
} from "../src/bench.js";
import { FALTA_EL_DATO } from "../src/types.js";

async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "atlas-bench-test-"));
  try {
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe("synthetic bench corpus", () => {
  it("writes only demo ids and a typed graph", async () => {
    await withTempDir(async (dir) => {
      const corpus = await writeSyntheticCorpus(dir, 9);
      expect(corpus.ficheCount).toBe(9);
      expect(corpus.hostId).toBe("host-demo-00");
      expect(corpus.botId).toBe("bot-synth-00");
      expect(corpus.roleId).toBe("role-synth-00");

      const host = await readFile(path.join(corpus.fichesDir, "host-demo-00.md"), "utf8");
      const graph = await readFile(corpus.graphPath, "utf8");
      expect(host).toMatch(/org-example/);
      expect(host).toMatch(/RAM_GB: 4/);
      expect(graph).toMatch(/comes_from|owns|related|leads_to/);
      expect(`${host}\n${graph}`).not.toMatch(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
      expect(benchQuestions(corpus).some((q) => q.includes("latencia"))).toBe(true);
    });
  });
});

describe("bench suite (mock embeddings)", () => {
  it("reuses embeddings on unchanged re-ingest and measures query including falta el dato", async () => {
    await withTempDir(async (dir) => {
      const outPath = path.join(dir, "bench-results.json");
      const report = await runBench({
        destDir: path.join(dir, "work"),
        ficheCount: 9,
        mode: "mock",
        outPath,
      });

      expect(report.mode).toBe("mock");
      expect(report.ficheCount).toBe(9);
      expect(report.chunkCount).toBeGreaterThan(0);
      expect(report.cold.embedded).toBe(report.chunkCount);
      expect(report.cold.reused).toBe(0);
      expect(report.cold.embedTexts).toBe(report.chunkCount);
      expect(report.cold.embedCalls).toBeGreaterThan(0);

      expect(report.reingest.embedded).toBe(0);
      expect(report.reingest.reused).toBe(report.chunkCount);
      expect(report.reingest.embedTexts).toBe(0);
      expect(report.reingest.embedCalls).toBe(0);

      expect(report.query.samples.length).toBe(8);
      expect(report.query.samples.some((sample) => sample.answer === FALTA_EL_DATO)).toBe(true);
      expect(report.query.samples.some((sample) => sample.answer.includes("RAM_GB"))).toBe(true);
      expect(report.query.p50Ms).toBeGreaterThanOrEqual(0);
      expect(report.query.p95Ms).toBeGreaterThanOrEqual(report.query.p50Ms);

      const written = JSON.parse(await readFile(outPath, "utf8")) as { reingest: { embedded: number } };
      expect(written.reingest.embedded).toBe(0);

      const printed = formatBenchReport(report);
      expect(printed).toMatch(/content_hash reuse/);
      expect(printed).toMatch(/embedded=0/);
    });
  });

  it("computes nearest-rank percentiles", () => {
    expect(percentile([], 50)).toBe(0);
    expect(percentile([10, 20, 30, 40], 50)).toBe(20);
    expect(percentile([10, 20, 30, 40], 95)).toBe(40);
  });
});

describe("bench CLI", () => {
  it("prints help without running ingest", async () => {
    const logs: string[] = [];
    const log = console.log;
    console.log = (message?: unknown) => {
      logs.push(String(message ?? ""));
    };
    try {
      const code = await runBenchCli(["--help"]);
      expect(code).toBe(0);
      expect(logs.join("\n")).toMatch(/--mode/);
      expect(logs.join("\n")).toMatch(/falta el dato/);
    } finally {
      console.log = log;
    }
  });

  it("rejects a non-integer fiche count", async () => {
    const errors: string[] = [];
    const err = console.error;
    console.error = (message?: unknown) => {
      errors.push(String(message ?? ""));
    };
    try {
      const code = await runBenchCli(["--fiches", "nope"]);
      expect(code).toBe(1);
      expect(errors.join("\n")).toMatch(/--fiches/);
    } finally {
      console.error = err;
    }
  });
});
