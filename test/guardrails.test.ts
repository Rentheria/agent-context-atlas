import { describe, expect, it } from "vitest";
import { findGuardrailHits } from "../src/guardrails.js";

describe("synthetic guardrails (generic patterns only)", () => {
  it("flags constructed IPv4, private IPv6 prefix, host suffix, and secret-like values", () => {
    const ipv4 = [10, 0, 0, 1].join(".");
    const ipv6 = ["fd12", "0000", "0000", "0001"].join(":");
    const host = ["box", "internal"].join(".");
    const pem = `-----BEGIN ${"PRIVATE KEY-----"}`;
    const token = `sk-${"d".repeat(20)}`;
    const assign = ["password", "demo"].join("=");

    expect(findGuardrailHits(ipv4).some((hit) => hit.kind === "ipv4")).toBe(true);
    expect(findGuardrailHits(ipv6).some((hit) => hit.kind === "ipv6_private")).toBe(true);
    expect(findGuardrailHits(host).some((hit) => hit.kind === "host_suffix")).toBe(true);
    expect(findGuardrailHits(pem).some((hit) => hit.kind === "credential_value")).toBe(true);
    expect(findGuardrailHits(token).some((hit) => hit.kind === "credential_value")).toBe(true);
    expect(findGuardrailHits(assign).some((hit) => hit.kind === "password_assign")).toBe(true);
  });

  it("does not flag synthetic demo ids or env var names without values", () => {
    const clean = [
      "host-demo-01 bot-alpha role-coordinator org-example",
      "ATLAS_EMBEDDINGS_API_KEY=",
      "local index .atlas/ NAV.md",
    ].join("\n");
    expect(findGuardrailHits(clean)).toEqual([]);
  });
});
