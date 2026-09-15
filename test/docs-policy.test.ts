import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("docs: bench without invented timings", () => {
  it("README ES/EN point at npm run bench and do not publish ms figures", async () => {
    const es = await readFile(path.join(root, "README.md"), "utf8");
    const en = await readFile(path.join(root, "README.en.md"), "utf8");
    expect(es).toMatch(/npm run bench/);
    expect(en).toMatch(/npm run bench/);
    expect(es).toMatch(/## Rendimiento/);
    expect(en).toMatch(/## Performance/);
    expect(es).not.toMatch(/\b\d+(?:\.\d+)?\s*ms\b/i);
    expect(en).not.toMatch(/\b\d+(?:\.\d+)?\s*ms\b/i);
    expect(es).not.toMatch(/\bp50\s*[:=]\s*\d/i);
    expect(en).not.toMatch(/\bp50\s*[:=]\s*\d/i);
  });

  it("synthetic quickstart uses demo ids and expected falta el dato", async () => {
    const example = await readFile(path.join(root, "examples/synthetic-quickstart.md"), "utf8");
    expect(example).toMatch(/host-demo-01/);
    expect(example).toMatch(/bot-alpha/);
    expect(example).toMatch(/org-example/);
    expect(example).toMatch(/falta el dato/);
    expect(example).toMatch(/npm run bench/);
    expect(example).not.toMatch(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
    expect(example).not.toMatch(/\.(internal|corp|lan)\b/i);
  });
});
