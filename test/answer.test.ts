import { describe, expect, it } from "vitest";
import { answerFromEvidence, hasMeasurementIntent } from "../src/answer.js";
import { FALTA_EL_DATO } from "../src/types.js";

describe("falta el dato rule", () => {
  const corpus = [
    "Máquina sintética host-demo-01 en org-example.",
    "RAM_GB: 4",
    "vCPU: 2",
    "max_context_tokens: 8192",
  ].join("\n");

  it("detects underscored metric names as measurement questions", () => {
    expect(hasMeasurementIntent("RAM_GB de host-demo-01")).toBe(true);
    expect(hasMeasurementIntent("max_context_tokens of bot-alpha")).toBe(true);
  });

  it("quotes a metric that is present", () => {
    expect(answerFromEvidence("RAM_GB de host-demo-01", corpus)).toMatch(/RAM_GB: 4/);
  });

  it("returns the exact phrase when the metric is missing", () => {
    expect(answerFromEvidence("latency of bot-alpha", corpus)).toBe(FALTA_EL_DATO);
    expect(answerFromEvidence("cuántas GPU tiene host-demo-01", corpus)).toBe(FALTA_EL_DATO);
  });

  it("never keeps a number that is not in the evidence", () => {
    expect(answerFromEvidence("RAM_GB de host-demo-01", "host-demo-01 sin cifras")).toBe(FALTA_EL_DATO);
  });
});
