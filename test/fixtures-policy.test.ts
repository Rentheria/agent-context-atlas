import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadFiches } from "../src/fiche.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("synthetic-only fixtures", () => {
  it("uses only demo ids and no private infra markers", async () => {
    const fiches = await loadFiches(path.join(root, "fixtures/fiches"));
    const blob = fiches.map((fiche) => fiche.raw).join("\n");
    const graph = await readFile(path.join(root, "fixtures/graph.json"), "utf8");
    const text = `${blob}\n${graph}`;

    expect(text).toMatch(/host-demo-01/);
    expect(text).toMatch(/bot-alpha/);
    expect(text).toMatch(/role-coordinator/);
    expect(text).toMatch(/org-example/);
    expect(text).not.toMatch(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
    expect(text).not.toMatch(/demo-lab/);
    expect(text).not.toMatch(/password|credential|api[_-]?key|secret/i);
    expect(text).not.toMatch(/\.(internal|corp|lan)\b/i);
  });
});
