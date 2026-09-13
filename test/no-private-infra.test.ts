import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKIP_DIRS = new Set(["node_modules", "dist", ".git", ".atlas", "data", "coverage"]);
const SKIP_FILES = new Set(["package-lock.json"]);

async function listFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const name of await readdir(dir)) {
    if (SKIP_DIRS.has(name) || SKIP_FILES.has(name)) continue;
    const full = path.join(dir, name);
    const info = await stat(full);
    if (info.isDirectory()) {
      out.push(...(await listFiles(full)));
    } else if (info.isFile()) {
      out.push(full);
    }
  }
  return out;
}

describe("public tree: no real infra or secrets", () => {
  it("has no IPv4 or private hostname suffixes in the public tree", async () => {
    const files = await listFiles(root);
    const hits: string[] = [];
    for (const file of files) {
      const rel = path.relative(root, file);
      const text = await readFile(file, "utf8");
      if (/\b(?:\d{1,3}\.){3}\d{1,3}\b/.test(text)) {
        hits.push(`${rel}: IPv4`);
      }
      if (/\.(internal|corp)\b/i.test(text)) {
        hits.push(`${rel}: private hostname`);
      }
    }
    expect(hits).toEqual([]);
  });
});
