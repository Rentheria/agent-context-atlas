import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { formatQueryJson, readPackageVersion, run } from "../src/cli.js";
import { MISSING_EMBEDDINGS_CREDENTIALS_MESSAGE } from "../src/embeddings.js";
import { FALTA_EL_DATO, type QueryResult } from "../src/types.js";
import { fakeEmbeddingsClient } from "./helpers.js";

const fixtures = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fixtures");

describe("CLI", () => {
  it("prints help for unknown commands", async () => {
    const logs: string[] = [];
    const errors: string[] = [];
    const log = console.log;
    const err = console.error;
    console.log = (message?: unknown) => {
      logs.push(String(message ?? ""));
    };
    console.error = (message?: unknown) => {
      errors.push(String(message ?? ""));
    };
    try {
      const code = await run(["help"]);
      expect(code).toBe(0);
      expect(logs.join("\n")).toMatch(/atlas ingest/);
      expect(logs.join("\n")).toMatch(/atlas doctor/);
      expect(logs.join("\n")).toMatch(/atlas graph/);
      expect(logs.join("\n")).toMatch(/--version/);
      expect(logs.join("\n")).toMatch(/--json/);
      expect(logs.join("\n")).toMatch(/--mock/);
      expect(logs.join("\n")).toMatch(/--out/);
      expect(logs.join("\n")).toMatch(/falta el dato/);

      const missing = await run(["query"]);
      expect(missing).toBe(1);
      expect(errors.join("\n")).toMatch(/atlas query/);
    } finally {
      console.log = log;
      console.error = err;
    }
  });

  it("prints machine-readable --json query output", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "atlas-cli-"));
    const logs: string[] = [];
    const log = console.log;
    console.log = (message?: unknown) => {
      logs.push(String(message ?? ""));
    };
    try {
      const embeddings = fakeEmbeddingsClient();
      const ingestCode = await run(
        ["ingest", "--fiches", path.join(fixtures, "fiches"), "--graph", path.join(fixtures, "graph.json"), "--index", dir],
        { embeddings },
      );
      expect(ingestCode).toBe(0);
      expect(logs.join("\n")).toMatch(/GRAPH\.mmd/);

      logs.length = 0;
      const queryCode = await run(["query", "--json", "--index", dir, "latencia de bot-alpha"], {
        embeddings,
      });
      expect(queryCode).toBe(0);
      const parsed = JSON.parse(logs.join("\n")) as QueryResult;
      expect(parsed.answer).toBe(FALTA_EL_DATO);
      expect(Array.isArray(parsed.sources)).toBe(true);
      expect(Array.isArray(parsed.neighbors)).toBe(true);
      expect(logs.join("\n")).not.toMatch(/^Fuentes:/m);
    } finally {
      console.log = log;
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("doctors the shipped fixtures and prints mermaid/dot graphs", async () => {
    const logs: string[] = [];
    const log = console.log;
    console.log = (message?: unknown) => {
      logs.push(String(message ?? ""));
    };
    try {
      const doctorCode = await run([
        "doctor",
        "--fiches",
        path.join(fixtures, "fiches"),
        "--graph",
        path.join(fixtures, "graph.json"),
      ]);
      expect(doctorCode).toBe(0);
      expect(logs.join("\n")).toMatch(/OK/);

      logs.length = 0;
      const mermaidCode = await run([
        "graph",
        "--format",
        "mermaid",
        "--fiches",
        path.join(fixtures, "fiches"),
        "--graph",
        path.join(fixtures, "graph.json"),
      ]);
      expect(mermaidCode).toBe(0);
      expect(logs.join("\n")).toMatch(/flowchart LR/);
      expect(logs.join("\n")).toMatch(/comes_from/);

      logs.length = 0;
      const dotCode = await run([
        "graph",
        "--format",
        "dot",
        "--fiches",
        path.join(fixtures, "fiches"),
        "--graph",
        path.join(fixtures, "graph.json"),
      ]);
      expect(dotCode).toBe(0);
      expect(logs.join("\n")).toMatch(/digraph atlas/);
      expect(logs.join("\n")).toMatch(/comes_from/);

      const bad = await run(["graph", "--format", "png"]);
      expect(bad).toBe(1);

      logs.length = 0;
      const outDir = await mkdtemp(path.join(os.tmpdir(), "atlas-graph-out-"));
      const outFile = path.join(outDir, "views", "graph.mmd");
      try {
        const outCode = await run([
          "graph",
          "--format",
          "mermaid",
          "--out",
          outFile,
          "--fiches",
          path.join(fixtures, "fiches"),
          "--graph",
          path.join(fixtures, "graph.json"),
        ]);
        expect(outCode).toBe(0);
        expect(logs.join("\n")).toMatch(/flowchart LR/);
        const written = await readFile(outFile, "utf8");
        expect(written).toMatch(/flowchart LR/);
        expect(written).toMatch(/comes_from/);
      } finally {
        await rm(outDir, { recursive: true, force: true });
      }
    } finally {
      console.log = log;
    }
  });

  it("prints package.json version for --version and -v", async () => {
    const pkg = JSON.parse(await readFile(path.join(path.dirname(fileURLToPath(import.meta.url)), "../package.json"), "utf8")) as {
      version: string;
    };
    expect(readPackageVersion()).toBe(pkg.version);

    const logs: string[] = [];
    const log = console.log;
    console.log = (message?: unknown) => {
      logs.push(String(message ?? ""));
    };
    try {
      expect(await run(["--version"])).toBe(0);
      expect(await run(["-v"])).toBe(0);
      expect(logs).toEqual([pkg.version, pkg.version]);
    } finally {
      console.log = log;
    }
  });

  it("serializes query results as JSON", () => {
    const result: QueryResult = {
      answer: FALTA_EL_DATO,
      sources: [],
      neighbors: ["host-demo-01"],
    };
    expect(JSON.parse(formatQueryJson(result))).toEqual(result);
  });

  it("prints a stable doctor --json object", async () => {
    const logs: string[] = [];
    const log = console.log;
    console.log = (message?: unknown) => {
      logs.push(String(message ?? ""));
    };
    try {
      const code = await run([
        "doctor",
        "--json",
        "--fiches",
        path.join(fixtures, "fiches"),
        "--graph",
        path.join(fixtures, "graph.json"),
      ]);
      expect(code).toBe(0);
      const report = JSON.parse(logs.join("\n")) as Record<string, unknown>;
      expect(Object.keys(report).sort()).toEqual([
        "danglingEdges",
        "edgeCount",
        "ficheCount",
        "ficheIds",
        "guardHits",
        "ok",
        "orphans",
      ]);
      expect(report.ok).toBe(true);
      expect(typeof report.ficheCount).toBe("number");
      expect(Array.isArray(report.ficheIds)).toBe(true);
      expect(typeof report.edgeCount).toBe("number");
      expect(Array.isArray(report.danglingEdges)).toBe(true);
      expect(Array.isArray(report.orphans)).toBe(true);
      expect(Array.isArray(report.guardHits)).toBe(true);
    } finally {
      console.log = log;
    }
  });

  it("fails ingest without a cloud key using the bilingual message, not a raw 401", async () => {
    const prev = {
      ATLAS_EMBEDDINGS_API_KEY: process.env.ATLAS_EMBEDDINGS_API_KEY,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      ATLAS_EMBEDDINGS_BASE_URL: process.env.ATLAS_EMBEDDINGS_BASE_URL,
    };
    delete process.env.ATLAS_EMBEDDINGS_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ATLAS_EMBEDDINGS_BASE_URL;
    try {
      await expect(
        run(["ingest", "--fiches", path.join(fixtures, "fiches"), "--graph", path.join(fixtures, "graph.json")]),
      ).rejects.toThrow(MISSING_EMBEDDINGS_CREDENTIALS_MESSAGE);
      await expect(
        run(["query", "RAM_GB de host-demo-01"]),
      ).rejects.toThrow(MISSING_EMBEDDINGS_CREDENTIALS_MESSAGE);
    } finally {
      restoreEnv(prev);
    }
  });

  it("ingests and queries offline with --mock (hit + falta el dato, no network)", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "atlas-mock-"));
    const logs: string[] = [];
    const log = console.log;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error("network must not be used with --mock");
    }) as typeof fetch;
    console.log = (message?: unknown) => {
      logs.push(String(message ?? ""));
    };
    const prev = {
      ATLAS_EMBEDDINGS_API_KEY: process.env.ATLAS_EMBEDDINGS_API_KEY,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      ATLAS_EMBEDDINGS_BASE_URL: process.env.ATLAS_EMBEDDINGS_BASE_URL,
    };
    delete process.env.ATLAS_EMBEDDINGS_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ATLAS_EMBEDDINGS_BASE_URL;
    try {
      const ingestCode = await run([
        "ingest",
        "--mock",
        "--fiches",
        path.join(fixtures, "fiches"),
        "--graph",
        path.join(fixtures, "graph.json"),
        "--index",
        dir,
      ]);
      expect(ingestCode).toBe(0);
      expect(logs.join("\n")).toMatch(/Ingest OK/);

      logs.length = 0;
      const hitCode = await run(["query", "--mock", "--index", dir, "RAM_GB de host-demo-01"]);
      expect(hitCode).toBe(0);
      expect(logs.join("\n")).toMatch(/RAM_GB/);
      expect(logs.join("\n")).toMatch(/4/);
      expect(logs.join("\n")).not.toBe(FALTA_EL_DATO);

      logs.length = 0;
      const missCode = await run(["query", "--mock", "--index", dir, "latencia de bot-alpha"]);
      expect(missCode).toBe(0);
      expect(logs.join("\n").split("\n")[0]).toBe(FALTA_EL_DATO);

      logs.length = 0;
      const jsonCode = await run(["query", "--mock", "--json", "--index", dir, "cuántas GPU tiene host-demo-01"]);
      expect(jsonCode).toBe(0);
      const parsed = JSON.parse(logs.join("\n")) as QueryResult;
      expect(parsed.answer).toBe(FALTA_EL_DATO);
    } finally {
      console.log = log;
      globalThis.fetch = originalFetch;
      restoreEnv(prev);
      await rm(dir, { recursive: true, force: true });
    }
  });
});

function restoreEnv(prev: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(prev)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

