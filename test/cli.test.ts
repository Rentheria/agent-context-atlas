import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { formatQueryJson, run } from "../src/cli.js";
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
      expect(logs.join("\n")).toMatch(/--json/);
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
});

