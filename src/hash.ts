import { createHash } from "node:crypto";

/** SHA-256 of newline-normalized, trimmed text. */
export function contentHash(text: string): string {
  return createHash("sha256").update(normalizeForHash(text), "utf8").digest("hex");
}

export function normalizeForHash(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\s+$/gm, "").trim();
}
