import { loadFiches } from "./fiche.js";
import { buildGraph, loadGraphFile } from "./graph.js";
import { findGuardrailHits, type GuardrailHit } from "./guardrails.js";
import type { GraphEdge } from "./types.js";

export interface DoctorOptions {
  fichesDir: string;
  graphPath?: string;
}

export interface DoctorReport {
  ok: boolean;
  ficheCount: number;
  ficheIds: string[];
  edgeCount: number;
  danglingEdges: GraphEdge[];
  orphans: string[];
  guardHits: GuardrailHit[];
}

/**
 * Validate a corpus: every typed edge endpoint must exist as a fiche.
 * Orphans (fiches with no incident edge) are reported but do not fail `ok`.
 * Guardrail hits on fixture text fail `ok`.
 */
export async function doctorCorpus(options: DoctorOptions): Promise<DoctorReport> {
  const fiches = await loadFiches(options.fichesDir);
  if (fiches.length === 0) {
    throw new Error(`No markdown fiches found in ${options.fichesDir}`);
  }

  const extra = options.graphPath ? await loadGraphFile(options.graphPath) : [];
  const graph = buildGraph(fiches, extra);
  const ids = new Set(fiches.map((fiche) => fiche.id));

  const danglingEdges = graph.edges.filter((edge) => !ids.has(edge.from) || !ids.has(edge.to));

  const connected = new Set<string>();
  for (const edge of graph.edges) {
    if (ids.has(edge.from)) connected.add(edge.from);
    if (ids.has(edge.to)) connected.add(edge.to);
  }
  const orphans = graph.nodes.filter((id) => !connected.has(id)).sort();

  const blob = fiches.map((fiche) => fiche.raw).join("\n");
  const guardHits = findGuardrailHits(blob);

  return {
    ok: danglingEdges.length === 0 && guardHits.length === 0,
    ficheCount: fiches.length,
    ficheIds: [...ids].sort(),
    edgeCount: graph.edges.length,
    danglingEdges,
    orphans,
    guardHits,
  };
}

export function formatDoctorReport(report: DoctorReport): string {
  const lines = [
    `atlas doctor — ${report.ok ? "OK" : "ISSUES"}`,
    `fichas=${report.ficheCount}  aristas=${report.edgeCount}  huérfanas=${report.orphans.length}  dangling=${report.danglingEdges.length}`,
    "",
  ];

  if (report.danglingEdges.length > 0) {
    lines.push("Aristas que apuntan a fichas inexistentes:");
    for (const edge of report.danglingEdges) {
      lines.push(`  - ${edge.from} -[${edge.type}]-> ${edge.to}`);
    }
    lines.push("");
  }

  if (report.orphans.length > 0) {
    lines.push("Fichas sin aristas (huérfanas; aviso, no error):");
    for (const id of report.orphans) {
      lines.push(`  - ${id}`);
    }
    lines.push("");
  } else {
    lines.push("Sin fichas huérfanas.");
    lines.push("");
  }

  if (report.guardHits.length > 0) {
    lines.push("Guardrails sintéticos (patrones genéricos):");
    for (const hit of report.guardHits) {
      lines.push(`  - ${hit.kind}: ${hit.excerpt}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}
