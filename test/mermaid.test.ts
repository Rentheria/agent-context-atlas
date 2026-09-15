import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadFiches } from "../src/fiche.js";
import {
  buildGraph,
  loadGraphFile,
  mermaidNodeId,
  renderGraphMarkdown,
  renderGraphMermaid,
} from "../src/graph.js";
import { ingest } from "../src/ingest.js";
import { fakeEmbeddingsClient } from "./helpers.js";

const fixtures = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fixtures");

describe("Mermaid graph renderer", () => {
  it("renders typed edges for the synthetic fixture graph", async () => {
    const fiches = await loadFiches(path.join(fixtures, "fiches"));
    const extra = await loadGraphFile(path.join(fixtures, "graph.json"));
    const graph = buildGraph(fiches, extra);
    const titles = Object.fromEntries(fiches.map((fiche) => [fiche.id, fiche.title]));
    const mermaid = renderGraphMermaid(graph, titles);

    expect(mermaid.startsWith("flowchart LR\n")).toBe(true);
    expect(mermaid).toContain('host_demo_01["host-demo-01 — Host de demostración 01"]');
    expect(mermaid).toContain("host_demo_01");
    expect(mermaid).toContain("bot_alpha");
    expect(mermaid).toContain("role_coordinator -->|owns| bot_alpha");
    expect(mermaid).toContain("bot_alpha -->|comes_from| host_demo_01");
    expect(mermaid).toContain("bot_alpha -->|related| bot_beta");
    expect(mermaid).toContain("role_coordinator -->|leads_to| role_operator");
    expect(mermaid).toMatch(/comes_from|leads_to|related|owns/);
    expect(mermaid).not.toMatch(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
  });

  it("sanitizes ids and still declares isolated nodes", () => {
    expect(mermaidNodeId("host-demo-01")).toBe("host_demo_01");
    expect(mermaidNodeId("9start")).toBe("n_9start");

    const mermaid = renderGraphMermaid({
      nodes: ["host-demo-99", "bot-synth-00"],
      edges: [],
    });
    expect(mermaid).toContain('host_demo_99["host-demo-99"]');
    expect(mermaid).toContain('bot_synth_00["bot-synth-00"]');
    expect(mermaid).not.toMatch(/-->/);
  });

  it("embeds a mermaid fence in NAV.md and writes GRAPH.mmd on ingest", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "atlas-mermaid-"));
    try {
      const result = await ingest({
        fichesDir: path.join(fixtures, "fiches"),
        graphPath: path.join(fixtures, "graph.json"),
        indexDir: dir,
        embeddings: fakeEmbeddingsClient(),
      });

      const nav = await readFile(result.navPath, "utf8");
      const mermaidFile = await readFile(result.mermaidPath, "utf8");
      expect(result.mermaidPath).toBe(path.join(dir, "GRAPH.mmd"));
      expect(nav).toContain("```mermaid");
      expect(nav).toContain("flowchart LR");
      expect(nav).toContain("role_coordinator -->|owns| bot_alpha");
      expect(mermaidFile.startsWith("flowchart LR\n")).toBe(true);
      expect(mermaidFile).toContain("role_coordinator -->|owns| bot_alpha");
      expect(mermaidFile).toContain("host-demo-01");
      expect(renderGraphMarkdown(JSON.parse(await readFile(path.join(dir, "index.json"), "utf8")).graph)).toContain(
        "```mermaid",
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
