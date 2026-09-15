import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadFiches } from "../src/fiche.js";
import { buildGraph, expandNeighbors, loadGraphFile, renderGraphMarkdown } from "../src/graph.js";

const fixtures = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fixtures");

describe("fiche loader + graph", () => {
  it("loads synthetic fixtures", async () => {
    const fiches = await loadFiches(path.join(fixtures, "fiches"));
    expect(fiches.map((fiche) => fiche.id).sort()).toEqual([
      "bot-alpha",
      "bot-beta",
      "host-demo-01",
      "role-coordinator",
      "role-operator",
    ]);
    expect(fiches.every((fiche) => fiche.content_hash.length === 64)).toBe(true);
    expect(fiches.find((fiche) => fiche.id === "host-demo-01")?.kind).toBe("machine");
  });

  it("builds a typed graph from graph.json and expands neighbors", async () => {
    const fiches = await loadFiches(path.join(fixtures, "fiches"));
    const extra = await loadGraphFile(path.join(fixtures, "graph.json"));
    const graph = buildGraph(fiches, extra);

    expect(graph.edges.every((edge) => ["comes_from", "leads_to", "related", "owns"].includes(edge.type))).toBe(
      true,
    );
    expect(graph.edges.some((edge) => edge.from === "role-coordinator" && edge.to === "bot-alpha" && edge.type === "owns")).toBe(
      true,
    );

    const neighbors = expandNeighbors(graph, ["bot-alpha"], 1);
    expect(neighbors).toEqual(expect.arrayContaining(["host-demo-01", "bot-beta", "role-coordinator"]));
  });

  it("renders markdown nav as a view of the graph", async () => {
    const fiches = await loadFiches(path.join(fixtures, "fiches"));
    const extra = await loadGraphFile(path.join(fixtures, "graph.json"));
    const graph = buildGraph(fiches, extra);
    const nav = renderGraphMarkdown(graph);
    expect(nav).toContain("# Atlas — navegación");
    expect(nav).toContain("**owns** → bot-alpha");
    expect(nav).toContain("**comes_from** → host-demo-01");
    expect(nav).toContain("```mermaid");
    expect(nav).toContain("flowchart LR");
  });

  it("rejects unknown edge types", async () => {
    await expect(
      loadGraphFile(path.join(fixtures, "graph.json")).then(() =>
        buildGraph([], [{ from: "a", to: "b", type: "depends_on" as never }]),
      ),
    ).rejects.toThrow(/Invalid edge/);
  });
});
