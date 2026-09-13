import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { contentHash } from "./hash.js";
import { isEdgeType, isFicheKind, type Fiche, type FicheEdgeRef, type FicheKind } from "./types.js";

export async function loadFiches(dir: string): Promise<Fiche[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => path.join(dir, entry.name))
    .sort();

  const fiches: Fiche[] = [];
  for (const filePath of files) {
    const raw = await readFile(filePath, "utf8");
    fiches.push(parseFiche(filePath, raw));
  }
  return fiches;
}

export function parseFiche(filePath: string, raw: string): Fiche {
  const { data, body } = splitFrontmatter(raw);
  const fallbackId = path.basename(filePath, path.extname(filePath));
  const id = asString(data.id) || fallbackId;
  const kind = parseKind(data.kind);
  const title = asString(data.title) || id;
  const edges = parseEdges(data.edges);

  return {
    id,
    kind,
    title,
    path: filePath,
    body,
    raw,
    content_hash: contentHash(raw),
    edges,
  };
}

function splitFrontmatter(raw: string): { data: Record<string, unknown>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!match) {
    return { data: {}, body: raw };
  }
  const parsed: unknown = parseYaml(match[1] ?? "");
  const data =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  return { data, body: match[2] ?? "" };
}

function parseKind(value: unknown): FicheKind {
  if (typeof value === "string" && isFicheKind(value)) return value;
  return "other";
}

function parseEdges(value: unknown): FicheEdgeRef[] {
  if (!Array.isArray(value)) return [];
  const edges: FicheEdgeRef[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const to = asString(rec.to);
    const type = asString(rec.type);
    if (!to || !isEdgeType(type)) {
      throw new Error(`Invalid fiche edge: ${JSON.stringify(item)}`);
    }
    edges.push({ to, type });
  }
  return edges;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
