import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AtlasIndex } from "./types.js";

export const INDEX_VERSION = 1 as const;

export function indexFilePath(indexDir: string): string {
  return path.join(indexDir, "index.json");
}

export function navFilePath(indexDir: string): string {
  return path.join(indexDir, "NAV.md");
}

export function mermaidFilePath(indexDir: string): string {
  return path.join(indexDir, "GRAPH.mmd");
}

export async function loadIndex(indexDir: string): Promise<AtlasIndex | null> {
  try {
    const raw = await readFile(indexFilePath(indexDir), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!isAtlasIndex(parsed)) return null;
    return parsed;
  } catch (error) {
    if (isEnoent(error)) return null;
    throw error;
  }
}

export async function saveIndex(indexDir: string, index: AtlasIndex): Promise<string> {
  await mkdir(indexDir, { recursive: true });
  const filePath = indexFilePath(indexDir);
  await writeFile(filePath, `${JSON.stringify(index, null, 2)}\n`, "utf8");
  return filePath;
}

export async function saveNav(indexDir: string, markdown: string): Promise<string> {
  await mkdir(indexDir, { recursive: true });
  const filePath = navFilePath(indexDir);
  await writeFile(filePath, markdown.endsWith("\n") ? markdown : `${markdown}\n`, "utf8");
  return filePath;
}

export async function saveMermaid(indexDir: string, mermaid: string): Promise<string> {
  await mkdir(indexDir, { recursive: true });
  const filePath = mermaidFilePath(indexDir);
  await writeFile(filePath, mermaid.endsWith("\n") ? mermaid : `${mermaid}\n`, "utf8");
  return filePath;
}

function isAtlasIndex(value: unknown): value is AtlasIndex {
  if (!value || typeof value !== "object") return false;
  const rec = value as Partial<AtlasIndex>;
  return (
    rec.version === INDEX_VERSION &&
    typeof rec.model === "string" &&
    typeof rec.updatedAt === "string" &&
    Boolean(rec.fiches) &&
    typeof rec.fiches === "object" &&
    Boolean(rec.graph) &&
    Array.isArray(rec.chunks)
  );
}

function isEnoent(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}
