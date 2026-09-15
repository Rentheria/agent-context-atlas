import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadFiches } from "../src/fiche.js";
import { buildGraph, loadGraphFile, renderGraphDot, renderGraphMermaid } from "../src/graph.js";

const fixtures = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fixtures");

describe("graph formats", () => {
  it("renders Graphviz DOT for the synthetic fixture graph", async () => {
    const fiches = await loadFiches(path.join(fixtures, "fiches"));
    const extra = await loadGraphFile(path.join(fixtures, "graph.json"));
    const graph = buildGraph(fiches, extra);
    const titles = Object.fromEntries(fiches.map((fiche) => [fiche.id, fiche.title]));
    const dot = renderGraphDot(graph, titles);

    expect(dot.startsWith("digraph atlas {")).toBe(true);
    expect(dot).toContain("rankdir=LR");
    expect(dot).toContain('"host-demo-01"');
    expect(dot).toContain('"bot-alpha" -> "host-demo-01" [label="comes_from"]');
    expect(dot).toContain('[label="owns"]');
    expect(dot).not.toMatch(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
  });

  it("keeps mermaid and dot as views of the same edges", async () => {
    const fiches = await loadFiches(path.join(fixtures, "fiches"));
    const extra = await loadGraphFile(path.join(fixtures, "graph.json"));
    const graph = buildGraph(fiches, extra);
    const mermaid = renderGraphMermaid(graph);
    const dot = renderGraphDot(graph);
    expect(mermaid).toContain("bot_alpha -->|comes_from| host_demo_01");
    expect(dot).toContain('"bot-alpha" -> "host-demo-01" [label="comes_from"]');
    expect(graph.edges.every((edge) => mermaid.includes(edge.type) && dot.includes(edge.type))).toBe(
      true,
    );
  });
});
