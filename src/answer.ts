import { FALTA_EL_DATO } from "./types.js";

const QUANTITY_RE = /cu[aá]nt[oa]s?|how many|how much|qu[eé] tan(?:to|ta)?\b/i;

const METRIC_LEX = new Set([
  "latency",
  "latencia",
  "ram",
  "ram_gb",
  "memoria",
  "cpu",
  "vcpu",
  "gpu",
  "gb",
  "mb",
  "tb",
  "disk",
  "disk_gb",
  "disco",
  "ms",
  "qps",
  "token",
  "tokens",
  "max_context_tokens",
  "quota",
  "cuota",
  "percent",
  "porcentaje",
  "uptime",
  "count",
  "conteo",
  "size",
  "tamano",
  "metric",
  "metrica",
  "medida",
  "spec",
  "especificacion",
]);

const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "of",
  "for",
  "in",
  "on",
  "to",
  "and",
  "or",
  "is",
  "are",
  "was",
  "what",
  "which",
  "who",
  "does",
  "do",
  "did",
  "has",
  "have",
  "with",
  "from",
  "el",
  "la",
  "los",
  "las",
  "un",
  "una",
  "de",
  "del",
  "en",
  "y",
  "o",
  "que",
  "que",
  "cual",
  "cual",
  "quien",
  "quien",
  "tiene",
  "tienen",
  "cuanta",
  "cuanta",
  "cuanto",
  "cuanto",
  "cuantas",
  "cuantas",
  "cuantos",
  "cuantos",
  "como",
  "como",
  "por",
  "para",
  "con",
  "sin",
  "su",
  "sus",
]);

const ENTITY_NOISE = new Set([
  "host",
  "demo",
  "org",
  "example",
  "bot",
  "alpha",
  "beta",
  "role",
  "coordinator",
  "operator",
  "ficha",
  "fiches",
  "sintetico",
  "sintetica",
]);

/**
 * Extractive answers only. Never invents a measured number:
 * if the question asks for a metric that is not in the evidence, return exactly "falta el dato".
 */
export function answerFromEvidence(question: string, evidence: string): string {
  const trimmedEvidence = evidence.trim();
  if (!trimmedEvidence) return FALTA_EL_DATO;

  const lines = splitLines(trimmedEvidence);
  const qTokens = tokenize(question);

  if (hasMeasurementIntent(question)) {
    const focus = measurementFocus(qTokens);
    const required = [...focus].filter(isMetricToken);
    const mustHave = required.length > 0 ? required : [...focus];
    if (mustHave.length === 0) return FALTA_EL_DATO;

    const candidates = lines.filter(
      (line) => hasMeasuredNumber(line) && lineHasTerms(line, mustHave),
    );
    const numbered = pickBestLine(qTokens, candidates);
    if (!numbered) return FALTA_EL_DATO;
    return guardInventedNumbers(numbered, trimmedEvidence);
  }

  const excerpts = pickExcerpts(qTokens, lines, 3);
  if (excerpts.length === 0) return FALTA_EL_DATO;
  return guardInventedNumbers(excerpts.join("\n"), trimmedEvidence);
}

export function hasMeasurementIntent(question: string): boolean {
  if (QUANTITY_RE.test(question)) return true;
  for (const token of tokenize(question)) {
    if (isMetricToken(token)) return true;
  }
  return false;
}

export function isMetricToken(token: string): boolean {
  if (METRIC_LEX.has(token)) return true;
  if (/^(ram|disk|cpu|gpu|mem|latenc)/.test(token)) return true;
  if (/_(gb|mb|tb|ms|tokens?)$/.test(token)) return true;
  return token.includes("token") || token.includes("latenc");
}

export function tokenize(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .split(/[^\p{L}\p{N}_]+/u)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
  return new Set(tokens);
}

function measurementFocus(question: Set<string>): Set<string> {
  const focus = new Set<string>();
  for (const token of question) {
    if (ENTITY_NOISE.has(token)) continue;
    if (/^\d+$/.test(token)) continue;
    focus.add(token);
  }
  return focus;
}

function lineHasTerms(line: string, terms: string[]): boolean {
  const lineTokens = tokenize(line);
  return terms.some(
    (term) =>
      lineTokens.has(term) ||
      [...lineTokens].some((token) => token.includes(term) || term.includes(token)),
  );
}

function pickBestLine(qTokens: Set<string>, lines: string[]): string | null {
  let best: { line: string; score: number } | null = null;
  for (const line of lines) {
    const score = overlapScore(qTokens, tokenize(line));
    if (score <= 0) continue;
    if (!best || score > best.score) best = { line, score };
  }
  return best?.line ?? null;
}

function pickExcerpts(qTokens: Set<string>, lines: string[], limit: number): string[] {
  return lines
    .map((line) => ({ line, score: overlapScore(qTokens, tokenize(line)) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.line);
}

function guardInventedNumbers(answer: string, evidence: string): string {
  const evidenceNums = new Set(extractNumbers(evidence));
  for (const num of extractNumbers(answer)) {
    if (!evidenceNums.has(num)) return FALTA_EL_DATO;
  }
  return answer;
}

function splitLines(text: string): string[] {
  return text
    .split(/\n+/)
    .map((line) => line.replace(/^\s*[-*|]\s*/, "").trim())
    .filter((line) => line.length > 0 && !/^#{1,6}\s/.test(line));
}

function overlapScore(question: Set<string>, line: Set<string>): number {
  let score = 0;
  for (const token of question) {
    if (line.has(token)) score += 1;
  }
  return score;
}

/** Ignore digits that only appear inside ids like host-demo-01. */
function hasMeasuredNumber(line: string): boolean {
  const stripped = line.replace(/\b[a-z]+(?:-[a-z0-9]+)+\b/gi, "");
  return /\d+(?:[.,]\d+)?/.test(stripped);
}

function extractNumbers(text: string): string[] {
  return text.match(/\d+(?:[.,]\d+)?/g) ?? [];
}
