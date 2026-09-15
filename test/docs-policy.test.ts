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
    expect(es).toMatch(/## Qué es \(y qué no es\)/);
    expect(en).toMatch(/## What this is \(and is not\)/);
    expect(es).toMatch(/toolkit público/);
    expect(en).toMatch(/public toolkit/);
    expect(es).toMatch(/inventario de operaciones privadas/);
    expect(en).toMatch(/private operations inventory/);
    expect(es).toMatch(/bóveda de notas personales/);
    expect(en).toMatch(/personal notes vault/);
    expect(es).toMatch(/```mermaid/);
    expect(en).toMatch(/```mermaid/);
    expect(es).toMatch(/coverage-Vitest/);
    expect(en).toMatch(/coverage-Vitest/);
    expect(es).toMatch(/<!-- \[!\[npm\]/);
    expect(en).toMatch(/<!-- \[!\[npm\]/);
    expect(es).toMatch(/ROADMAP\.md/);
    expect(en).toMatch(/ROADMAP\.md/);
    expect(es).toMatch(/atlas doctor/);
    expect(en).toMatch(/atlas doctor/);
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

  it("richer examples show hit vs falta el dato and a mermaid graph", async () => {
    const hit = await readFile(path.join(root, "examples/hit-vs-falta.md"), "utf8");
    const mermaid = await readFile(path.join(root, "examples/graph.mmd"), "utf8");
    const index = await readFile(path.join(root, "examples/README.md"), "utf8");
    const roadmap = await readFile(path.join(root, "ROADMAP.md"), "utf8");
    expect(hit).toMatch(/RAM_GB de host-demo-01/);
    expect(hit).toMatch(/falta el dato/);
    expect(hit).toMatch(/atlas doctor/);
    expect(mermaid).toMatch(/flowchart LR/);
    expect(mermaid).toMatch(/host-demo-01|host_demo_01/);
    expect(index).toMatch(/hit-vs-falta/);
    expect(roadmap).toMatch(/## P0/);
    expect(roadmap).toMatch(/## P1/);
    expect(roadmap).toMatch(/## P2/);
    expect(roadmap).toMatch(/Not a private operations inventory/);
  });
});
