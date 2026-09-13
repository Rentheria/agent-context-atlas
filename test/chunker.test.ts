import { describe, expect, it } from "vitest";
import { chunkMarkdown } from "../src/chunker.js";

describe("chunkMarkdown", () => {
  it("splits on headings and assigns stable ids", () => {
    const chunks = chunkMarkdown(
      "host-demo-01",
      "# host-demo-01\n\nIntro.\n\n## Specs\n\nRAM_GB: 4\n",
    );
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0]?.id).toBe("host-demo-01:0");
    expect(chunks.some((chunk) => chunk.heading === "Specs")).toBe(true);
    expect(chunks.every((chunk) => chunk.content_hash.length === 64)).toBe(true);
  });

  it("rejects overlap that cannot progress", () => {
    const long = `${"word ".repeat(80)}end`;
    expect(() => chunkMarkdown("bot-alpha", long, { maxChars: 40, overlap: 40 })).toThrow(
      /overlap/,
    );
    expect(() => chunkMarkdown("bot-alpha", long, { maxChars: 0, overlap: 0 })).toThrow(/maxChars/);
  });

  it("wraps long sections", () => {
    const long = `${"word ".repeat(400)}end`;
    const chunks = chunkMarkdown("bot-alpha", long, { maxChars: 80, overlap: 10 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.ficheId === "bot-alpha")).toBe(true);
  });
});
