import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { doctorCorpus, formatDoctorReport } from "../src/doctor.js";

const fixtures = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fixtures");

describe("atlas doctor", () => {
  it("accepts the shipped synthetic fixtures", async () => {
    const report = await doctorCorpus({
      fichesDir: path.join(fixtures, "fiches"),
      graphPath: path.join(fixtures, "graph.json"),
    });
    expect(report.ok).toBe(true);
    expect(report.danglingEdges).toEqual([]);
    expect(report.orphans).toEqual([]);
    expect(report.guardHits).toEqual([]);
    expect(report.ficheIds).toEqual(
      expect.arrayContaining(["host-demo-01", "bot-alpha", "role-coordinator"]),
    );
    expect(formatDoctorReport(report)).toMatch(/OK/);
  });

  it("keeps a stable doctor JSON contract", async () => {
    const report = await doctorCorpus({
      fichesDir: path.join(fixtures, "fiches"),
      graphPath: path.join(fixtures, "graph.json"),
    });
    expect(Object.keys(report).sort()).toEqual([
      "danglingEdges",
      "edgeCount",
      "ficheCount",
      "ficheIds",
      "guardHits",
      "ok",
      "orphans",
    ]);
    expect(typeof report.ok).toBe("boolean");
    expect(typeof report.ficheCount).toBe("number");
    expect(Array.isArray(report.ficheIds)).toBe(true);
    expect(report.ficheIds.every((id) => typeof id === "string")).toBe(true);
    expect(typeof report.edgeCount).toBe("number");
    expect(Array.isArray(report.danglingEdges)).toBe(true);
    expect(
      report.danglingEdges.every(
        (edge) =>
          typeof edge.from === "string" && typeof edge.to === "string" && typeof edge.type === "string",
      ),
    ).toBe(true);
    expect(Array.isArray(report.orphans)).toBe(true);
    expect(Array.isArray(report.guardHits)).toBe(true);
    expect(
      report.guardHits.every((hit) => typeof hit.kind === "string" && typeof hit.excerpt === "string"),
    ).toBe(true);
  });

  it("fails when an edge points at a missing fiche and reports orphans", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "atlas-doctor-"));
    try {
      const fichesDir = path.join(dir, "fiches");
      await mkdir(fichesDir, { recursive: true });
      await writeFile(
        path.join(fichesDir, "host-demo-77.md"),
        `---
id: host-demo-77
kind: machine
title: Host demo 77
---

# host-demo-77

org-example
`,
        "utf8",
      );
      await writeFile(
        path.join(fichesDir, "bot-synth-77.md"),
        `---
id: bot-synth-77
kind: bot
title: Bot 77
---

# bot-synth-77

org-example
`,
        "utf8",
      );
      const graphPath = path.join(dir, "graph.json");
      await writeFile(
        graphPath,
        JSON.stringify({
          edges: [{ from: "bot-synth-77", to: "host-missing-99", type: "comes_from" }],
        }),
        "utf8",
      );

      const report = await doctorCorpus({ fichesDir, graphPath });
      expect(report.ok).toBe(false);
      expect(report.danglingEdges).toEqual([
        { from: "bot-synth-77", to: "host-missing-99", type: "comes_from" },
      ]);
      expect(report.orphans).toEqual(["host-demo-77"]);
      expect(formatDoctorReport(report)).toMatch(/ISSUES/);
      expect(formatDoctorReport(report)).toMatch(/host-missing-99/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
