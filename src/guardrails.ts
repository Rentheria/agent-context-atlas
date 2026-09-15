/**
 * Generic public-tree guardrails. Patterns only — no teammate nicknames,
 * private product names, or deployment fingerprints as string literals.
 */

export const IPV4_RE = /\b(?:\d{1,3}\.){3}\d{1,3}\b/;

/** Link-local / unique-local IPv6 (not a full IPv6 parser). */
export const PRIVATE_IPV6_RE = /\b(?:fe80|fc[0-9a-f]{2}|fd[0-9a-f]{2}):[0-9a-f:]+/i;

export const PRIVATE_HOST_SUFFIX_RE =
  /\.(internal|corp|lan|intranet|private|localdomain|local)\b/i;

/** Assigned secret-looking values, not documentation of env var *names*. */
export const CREDENTIAL_VALUE_RE =
  /-----BEGIN [A-Z ]*PRIVATE KEY-----|\bsk-[A-Za-z0-9]{16,}|\bghp_[A-Za-z0-9]{20,}|\bxox[baprs]-[A-Za-z0-9-]{10,}|\bAKIA[A-Z0-9]{16}\b/;

export const PASSWORD_ASSIGN_RE = /\b(password|passwd|secret)\s*[:=]\s*\S+/i;

export interface GuardrailHit {
  kind: "ipv4" | "ipv6_private" | "host_suffix" | "credential_value" | "password_assign";
  excerpt: string;
}

export function findGuardrailHits(text: string): GuardrailHit[] {
  const hits: GuardrailHit[] = [];
  pushMatches(hits, text, IPV4_RE, "ipv4");
  pushMatches(hits, text, PRIVATE_IPV6_RE, "ipv6_private");
  pushMatches(hits, text, PRIVATE_HOST_SUFFIX_RE, "host_suffix");
  pushMatches(hits, text, CREDENTIAL_VALUE_RE, "credential_value");
  pushMatches(hits, text, PASSWORD_ASSIGN_RE, "password_assign");
  return hits;
}

function pushMatches(
  hits: GuardrailHit[],
  text: string,
  re: RegExp,
  kind: GuardrailHit["kind"],
): void {
  const flags = re.flags.includes("g") ? re.flags : `${re.flags}g`;
  const global = new RegExp(re.source, flags);
  for (const match of text.matchAll(global)) {
    const excerpt = (match[0] ?? "").slice(0, 80);
    if (!excerpt) continue;
    hits.push({ kind, excerpt });
  }
}
