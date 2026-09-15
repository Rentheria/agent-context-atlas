import { readFile } from "node:fs/promises";
import { isEdgeType, type DocGraph, type Fiche, type GraphEdge } from "./types.js";

export async function loadGraphFile(filePath: string): Promise<GraphEdge[]> {
  const raw = await readFile(filePath, "utf8");
  const parsed: unknown = JSON.parse(raw);
  const edges = extractEdges(parsed);
  return edges.map(assertEdge);
}

export function buildGraph(fiches: Fiche[], extraEdges: GraphEdge[] = []): DocGraph {
  const nodes = fiches.map((fiche) => fiche.id).sort();
  const fromFiches: GraphEdge[] = fiches.flatMap((fiche) =>
    fiche.edges.map((edge) => ({ from: fiche.id, to: edge.to, type: edge.type })),
  );
  const merged = dedupeEdges([...fromFiches, ...extraEdges].map(assertEdge));
  return { nodes, edges: merged };
}

export function expandNeighbors(graph: DocGraph, seedIds: string[], hops = 1): string[] {
  const adjacency = undirectedAdjacency(graph);
  const seen = new Set<string>(seedIds);
  let frontier = [...new Set(seedIds)];

  for (let hop = 0; hop < hops; hop += 1) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const neighbor of adjacency.get(id) ?? []) {
        if (seen.has(neighbor)) continue;
        seen.add(neighbor);
        next.push(neighbor);
      }
    }
    frontier = next;
  }

  for (const seed of seedIds) seen.delete(seed);
  return [...seen].sort();
}

/** Readable markdown navigation — a view of the typed graph, not a second source of truth. */
export function renderGraphMarkdown(graph: DocGraph, titles: Record<string, string> = {}): string {
  const lines = [
    "# Atlas — navegación (vista del grafo)",
    "",
    `Nodos: ${graph.nodes.length} · Aristas: ${graph.edges.length}`,
    "",
    "Tipos de arista: `comes_from` | `leads_to` | `related` | `owns`.",
    "",
  ];

  for (const id of graph.nodes) {
    const title = titles[id] && titles[id] !== id ? `${id} — ${titles[id]}` : id;
    lines.push(`## ${title}`, "");
    const outgoing = graph.edges.filter((edge) => edge.from === id);
    const incoming = graph.edges.filter((edge) => edge.to === id);
    if (outgoing.length === 0 && incoming.length === 0) {
      lines.push("- *(sin aristas)*", "");
      continue;
    }
    for (const edge of outgoing) {
      lines.push(`- **${edge.type}** → ${edge.to}`);
    }
    for (const edge of incoming) {
      lines.push(`- **${edge.type}** ← ${edge.from}`);
    }
    lines.push("");
  }

  const mermaid = renderGraphMermaid(graph, titles).trimEnd();
  lines.push(
    "## Grafo (Mermaid)",
    "",
    "Vista del grafo tipado; no es una segunda fuente de verdad.",
    "",
    "```mermaid",
    mermaid,
    "```",
    "",
  );

  return lines.join("\n");
}

/** Standalone Mermaid flowchart of typed edges (also written to `.atlas/GRAPH.mmd`). */
export function renderGraphMermaid(graph: DocGraph, titles: Record<string, string> = {}): string {
  const lines = ["flowchart LR"];

  for (const id of graph.nodes) {
    const title = titles[id];
    const label = title && title !== id ? `${id} — ${title}` : id;
    lines.push(`  ${mermaidNodeId(id)}["${escapeMermaidLabel(label)}"]`);
  }

  for (const edge of graph.edges) {
    lines.push(`  ${mermaidNodeId(edge.from)} -->|${edge.type}| ${mermaidNodeId(edge.to)}`);
  }

  return `${lines.join("\n")}\n`;
}

/** Mermaid node ids must be alphanumeric/underscore and start with a letter. */
export function mermaidNodeId(id: string): string {
  const safe = id.replace(/[^A-Za-z0-9_]/g, "_");
  return /^[A-Za-z]/.test(safe) ? safe : `n_${safe}`;
}

function escapeMermaidLabel(text: string): string {
  return text.replace(/["[\]|]/g, " ").replace(/\s+/g, " ").trim();
}

/** Graphviz DOT view of the same typed edges (stdout via `atlas graph --format dot`). */
export function renderGraphDot(graph: DocGraph, titles: Record<string, string> = {}): string {
  const lines = ["digraph atlas {", "  rankdir=LR;"];
  for (const id of graph.nodes) {
    const title = titles[id];
    const label = title && title !== id ? `${id} — ${title}` : id;
    lines.push(`  ${dotQuote(id)} [label=${dotQuote(label)}];`);
  }
  for (const edge of graph.edges) {
    lines.push(`  ${dotQuote(edge.from)} -> ${dotQuote(edge.to)} [label=${dotQuote(edge.type)}];`);
  }
  lines.push("}", "");
  return lines.join("\n");
}

function dotQuote(text: string): string {
  return JSON.stringify(text);
}

function extractEdges(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object" && "edges" in parsed) {
    const edges = (parsed as { edges: unknown }).edges;
    if (Array.isArray(edges)) return edges;
  }
  throw new Error("graph file must be an array of edges or { edges: [...] }");
}

function assertEdge(value: unknown): GraphEdge {
  if (!value || typeof value !== "object") {
    throw new Error(`Invalid edge: ${JSON.stringify(value)}`);
  }
  const rec = value as Record<string, unknown>;
  const from = typeof rec.from === "string" ? rec.from.trim() : "";
  const to = typeof rec.to === "string" ? rec.to.trim() : "";
  const type = typeof rec.type === "string" ? rec.type.trim() : "";
  if (!from || !to || !isEdgeType(type)) {
    throw new Error(`Invalid edge (expected from/to/typed type): ${JSON.stringify(value)}`);
  }
  return { from, to, type };
}

function dedupeEdges(edges: GraphEdge[]): GraphEdge[] {
  const seen = new Set<string>();
  const out: GraphEdge[] = [];
  for (const edge of edges) {
    const key = `${edge.from}\0${edge.to}\0${edge.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(edge);
  }
  return out;
}

function undirectedAdjacency(graph: DocGraph): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  const add = (from: string, to: string): void => {
    const set = map.get(from) ?? new Set<string>();
    set.add(to);
    map.set(from, set);
  };
  for (const edge of graph.edges) {
    add(edge.from, edge.to);
    add(edge.to, edge.from);
  }
  return map;
}
