import { contentHash } from "./hash.js";
import type { Chunk } from "./types.js";

export interface ChunkOptions {
  maxChars?: number;
  overlap?: number;
}

const DEFAULT_MAX_CHARS = 1200;
const DEFAULT_OVERLAP = 120;

/**
 * Split markdown into heading-aware chunks, then wrap long sections.
 */
export function chunkMarkdown(
  ficheId: string,
  markdown: string,
  options: ChunkOptions = {},
): Chunk[] {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const overlap = options.overlap ?? DEFAULT_OVERLAP;
  const sections = splitByHeading(markdown);
  const chunks: Chunk[] = [];

  for (const section of sections) {
    const pieces = wrapText(section.text, maxChars, overlap);
    for (const text of pieces) {
      const trimmed = text.trim();
      if (!trimmed) continue;
      chunks.push({
        id: "",
        ficheId,
        heading: section.heading,
        text: trimmed,
        content_hash: contentHash(trimmed),
      });
    }
  }

  return chunks.map((chunk, index) => ({
    ...chunk,
    id: `${ficheId}:${index}`,
  }));
}

interface Section {
  heading: string;
  text: string;
}

function splitByHeading(markdown: string): Section[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const sections: Section[] = [];
  let heading = "";
  let buf: string[] = [];

  const flush = (): void => {
    const text = buf.join("\n").trim();
    if (text) sections.push({ heading, text });
    buf = [];
  };

  for (const line of lines) {
    const match = /^(#{1,6})\s+(.+)$/.exec(line);
    if (match) {
      flush();
      heading = match[2]?.trim() ?? "";
      buf.push(line);
      continue;
    }
    buf.push(line);
  }
  flush();

  if (sections.length === 0 && markdown.trim()) {
    return [{ heading: "", text: markdown.trim() }];
  }
  return sections;
}

function wrapText(text: string, maxChars: number, overlap: number): string[] {
  if (text.length <= maxChars) return [text];

  const paragraphs = text.split(/\n{2,}/);
  const pieces: string[] = [];
  let current = "";

  const pushCurrent = (): void => {
    if (current.trim()) pieces.push(current.trim());
    if (overlap > 0 && current.length > overlap) {
      current = current.slice(-overlap);
    } else {
      current = "";
    }
  };

  for (const para of paragraphs) {
    const candidate = current ? `${current}\n\n${para}` : para;
    if (candidate.length > maxChars && current) {
      pushCurrent();
      current = para;
    } else {
      current = candidate;
    }
    while (current.length > maxChars) {
      pieces.push(current.slice(0, maxChars).trim());
      current = current.slice(maxChars - overlap);
    }
  }
  if (current.trim()) pieces.push(current.trim());
  return pieces;
}
