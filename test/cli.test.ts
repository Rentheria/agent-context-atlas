import { describe, expect, it } from "vitest";
import { run } from "../src/cli.js";

describe("CLI", () => {
  it("prints help for unknown commands", async () => {
    const logs: string[] = [];
    const errors: string[] = [];
    const log = console.log;
    const err = console.error;
    console.log = (message?: unknown) => {
      logs.push(String(message ?? ""));
    };
    console.error = (message?: unknown) => {
      errors.push(String(message ?? ""));
    };
    try {
      const code = await run(["help"]);
      expect(code).toBe(0);
      expect(logs.join("\n")).toMatch(/atlas ingest/);
      expect(logs.join("\n")).toMatch(/falta el dato/);

      const missing = await run(["query"]);
      expect(missing).toBe(1);
      expect(errors.join("\n")).toMatch(/atlas query/);
    } finally {
      console.log = log;
      console.error = err;
    }
  });
});
