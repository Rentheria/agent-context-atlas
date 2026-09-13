import { describe, expect, it } from "vitest";
import { contentHash } from "../src/hash.js";

describe("contentHash", () => {
  it("is stable for the same normalized text", () => {
    expect(contentHash("hello\nworld\n")).toBe(contentHash("hello\nworld"));
    expect(contentHash("hello\r\nworld")).toBe(contentHash("hello\nworld"));
  });

  it("changes when content changes", () => {
    expect(contentHash("RAM_GB: 4")).not.toBe(contentHash("RAM_GB: 8"));
  });

  it("is a sha256 hex digest", () => {
    expect(contentHash("demo")).toMatch(/^[a-f0-9]{64}$/);
  });
});
