import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import type { EmbeddingsClient } from "./embeddings.js";
import { createOpenAICompatibleEmbeddings, embeddingsConfigFromEnv } from "./embeddings.js";
import { ingest } from "./ingest.js";
import { query } from "./query.js";
import { FALTA_EL_DATO } from "./types.js";

export const DEFAULT_BENCH_FICHES = 80;
export const DEFAULT_CI_FICHES = 12;
export const DEFAULT_BENCH_OUT = "bench-results.json";

/** Soft CI timing gates (warn only). Reuse is a hard check. Not a production SLA. */
export const CI_SOFT_COLD_MS = 60_000;
export const CI_SOFT_QUERY_P95_MS = 10_000;

export type BenchMode = "mock" | "http";

export interface SyntheticCorpus {
  fichesDir: string;
  graphPath: string;
  ficheCount: number;
  hostId: string;
  botId: string;
  roleId: string;
}

export interface CountingEmbeddingsClient extends EmbeddingsClient {
  embedCalls: number;
  embedTexts: number;
  resetCounts(): void;
}

export interface PhaseStats {
  ms: number;
  embedded: number;
  reused: number;
  embedCalls: number;
  embedTexts: number;
}

export interface QuerySample {
  question: string;
  answer: string;
  ms: number;
}

export interface BenchReport {
  generatedAt: string;
  mode: BenchMode;
  node: string;
  ficheCount: number;
  chunkCount: number;
  cold: PhaseStats;
  reingest: PhaseStats;
  query: {
    samples: QuerySample[];
    p50Ms: number;
    p95Ms: number;
  };
}

export interface RunBenchOptions {
  destDir: string;
  ficheCount?: number;
  mode?: BenchMode;
  embeddings?: EmbeddingsClient;
  outPath?: string | null;
}

const SYNTHETIC_VCPU = 2;
const SYNTHETIC_RAM_GB = 4;
const SYNTHETIC_DISK_GB = 32;
const SYNTHETIC_TOKENS = 8192;

export function countingEmbeddings(inner: EmbeddingsClient): CountingEmbeddingsClient {
  let embedCalls = 0;
  let embedTexts = 0;
  return {
    get model() {
      return inner.model;
    },
    get embedCalls() {
      return embedCalls;
    },
    get embedTexts() {
      return embedTexts;
    },
    resetCounts() {
      embedCalls = 0;
      embedTexts = 0;
    },
    async embed(texts: string[]) {
      embedCalls += 1;
      embedTexts += texts.length;
      return inner.embed(texts);
    },
  };
}

/** Deterministic bag-of-words vectors — no HTTP. Same idea as the test helper. */
export function mockEmbeddingsClient(model = "bench-mock"): EmbeddingsClient {
  return {
    model,
    async embed(texts: string[]) {
      return texts.map((text) => fakeEmbedding(text));
    },
  };
}

export function fakeEmbedding(text: string, dim = 32): number[] {
  const vec = new Array<number>(dim).fill(0);
  const tokens = text.toLowerCase().split(/\W+/).filter(Boolean);
  for (const token of tokens) {
    let hash = 0;
    for (let i = 0; i < token.length; i += 1) {
      hash = (hash * 31 + token.charCodeAt(i)) >>> 0;
    }
    const index = hash % dim;
    vec[index] = (vec[index] ?? 0) + 1;
  }
  let norm = 0;
  for (const value of vec) norm += value * value;
  norm = Math.sqrt(norm);
  if (norm === 0) return vec;
  return vec.map((value) => value / norm);
}

export async function writeSyntheticCorpus(
  destDir: string,
  ficheCount = DEFAULT_BENCH_FICHES,
): Promise<SyntheticCorpus> {
  if (!Number.isInteger(ficheCount) || ficheCount < 3) {
    throw new Error("ficheCount must be an integer >= 3");
  }

  const fichesDir = path.join(destDir, "fiches");
  await mkdir(fichesDir, { recursive: true });

  const hosts: string[] = [];
  const bots: string[] = [];
  const roles: string[] = [];

  for (let i = 0; i < ficheCount; i += 1) {
    const slot = i % 3;
    if (slot === 0) {
      const id = `host-demo-${pad(hosts.length)}`;
      hosts.push(id);
      await writeFile(path.join(fichesDir, `${id}.md`), hostFiche(id), "utf8");
    } else if (slot === 1) {
      const id = `bot-synth-${pad(bots.length)}`;
      bots.push(id);
      await writeFile(path.join(fichesDir, `${id}.md`), botFiche(id, hosts[0] ?? "host-demo-00"), "utf8");
    } else {
      const id = `role-synth-${pad(roles.length)}`;
      roles.push(id);
      await writeFile(path.join(fichesDir, `${id}.md`), roleFiche(id), "utf8");
    }
  }

  const edges: { from: string; to: string; type: string }[] = [];
  for (const [i, bot] of bots.entries()) {
    const host = hosts[i % hosts.length];
    const role = roles[i % roles.length];
    if (host) edges.push({ from: bot, to: host, type: "comes_from" });
    if (role) edges.push({ from: role, to: bot, type: "owns" });
    const other = bots[(i + 1) % bots.length];
    if (other && other !== bot) edges.push({ from: bot, to: other, type: "related" });
  }
  for (const [i, role] of roles.entries()) {
    const next = roles[(i + 1) % roles.length];
    if (next && next !== role) edges.push({ from: role, to: next, type: "leads_to" });
  }

  const graphPath = path.join(destDir, "graph.json");
  await writeFile(graphPath, `${JSON.stringify({ edges }, null, 2)}\n`, "utf8");

  const hostId = hosts[0];
  const botId = bots[0];
  const roleId = roles[0];
  if (!hostId || !botId || !roleId) {
    throw new Error("synthetic corpus must include at least one host, bot, and role");
  }

  return {
    fichesDir,
    graphPath,
    ficheCount,
    hostId,
    botId,
    roleId,
  };
}

export function benchQuestions(corpus: SyntheticCorpus): string[] {
  return [
    `RAM_GB de ${corpus.hostId}`,
    `vCPU de ${corpus.hostId}`,
    `disk_GB de ${corpus.hostId}`,
    `max_context_tokens of ${corpus.botId}`,
    `latencia de ${corpus.botId}`,
    `cuántas GPU tiene ${corpus.hostId}`,
    `RAM_GB de ${corpus.botId}`,
    `${corpus.roleId} owns`,
  ];
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[rank] ?? 0;
}

export async function runBench(options: RunBenchOptions): Promise<BenchReport> {
  const ficheCount = options.ficheCount ?? DEFAULT_BENCH_FICHES;
  const mode = options.mode ?? "mock";
  const corpus = await writeSyntheticCorpus(options.destDir, ficheCount);
  const indexDir = path.join(options.destDir, "index");
  const inner = options.embeddings ?? embeddingsForMode(mode);
  const embeddings = countingEmbeddings(inner);

  embeddings.resetCounts();
  const coldStarted = performance.now();
  const coldResult = await ingest({
    fichesDir: corpus.fichesDir,
    graphPath: corpus.graphPath,
    indexDir,
    embeddings,
  });
  const cold: PhaseStats = {
    ms: performance.now() - coldStarted,
    embedded: coldResult.embedded,
    reused: coldResult.reused,
    embedCalls: embeddings.embedCalls,
    embedTexts: embeddings.embedTexts,
  };

  embeddings.resetCounts();
  const reStarted = performance.now();
  const reResult = await ingest({
    fichesDir: corpus.fichesDir,
    graphPath: corpus.graphPath,
    indexDir,
    embeddings,
  });
  const reingest: PhaseStats = {
    ms: performance.now() - reStarted,
    embedded: reResult.embedded,
    reused: reResult.reused,
    embedCalls: embeddings.embedCalls,
    embedTexts: embeddings.embedTexts,
  };

  const samples: QuerySample[] = [];
  for (const question of benchQuestions(corpus)) {
    const started = performance.now();
    const result = await query({ question, indexDir, embeddings });
    samples.push({
      question,
      answer: result.answer,
      ms: performance.now() - started,
    });
  }

  const latencies = samples.map((sample) => sample.ms);
  const report: BenchReport = {
    generatedAt: new Date().toISOString(),
    mode,
    node: process.version,
    ficheCount: corpus.ficheCount,
    chunkCount: coldResult.chunkCount,
    cold,
    reingest,
    query: {
      samples,
      p50Ms: percentile(latencies, 50),
      p95Ms: percentile(latencies, 95),
    },
  };

  if (options.outPath !== null) {
    const outPath = options.outPath ?? path.join(process.cwd(), DEFAULT_BENCH_OUT);
    await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }

  return report;
}

export function formatBenchReport(report: BenchReport): string {
  const lines = [
    "agent-context-atlas bench",
    `mode=${report.mode}  node=${report.node}  fiches=${report.ficheCount}  chunks=${report.chunkCount}`,
    "",
    `cold ingest     ${fmtMs(report.cold.ms)}  embedded=${report.cold.embedded}  reused=${report.cold.reused}  embedTexts=${report.cold.embedTexts}  embedCalls=${report.cold.embedCalls}`,
    `re-ingest       ${fmtMs(report.reingest.ms)}  embedded=${report.reingest.embedded}  reused=${report.reingest.reused}  embedTexts=${report.reingest.embedTexts}  embedCalls=${report.reingest.embedCalls}`,
    "",
    "content_hash reuse: re-ingest should embed 0 texts when the corpus is unchanged.",
    "",
    `query n=${report.query.samples.length}  p50=${fmtMs(report.query.p50Ms)}  p95=${fmtMs(report.query.p95Ms)}`,
  ];
  for (const sample of report.query.samples) {
    const preview = sample.answer === FALTA_EL_DATO ? FALTA_EL_DATO : truncate(sample.answer, 60);
    lines.push(`  ${fmtMs(sample.ms)}  ${sample.question}  →  ${preview}`);
  }
  lines.push(
    "",
    "Machine-local only. Not a production SLA. Re-run with: npm run bench",
  );
  return lines.join("\n");
}

export interface BenchCiEvaluation {
  hardFails: string[];
  softWarns: string[];
}

export function evaluateBenchCi(report: BenchReport): BenchCiEvaluation {
  const hardFails: string[] = [];
  const softWarns: string[] = [];

  if (report.reingest.embedded !== 0 || report.reingest.embedTexts !== 0) {
    hardFails.push(
      `re-ingest must reuse embeddings (embedded=${report.reingest.embedded} embedTexts=${report.reingest.embedTexts})`,
    );
  }
  if (report.reingest.reused !== report.chunkCount) {
    hardFails.push(`re-ingest reused=${report.reingest.reused} expected ${report.chunkCount}`);
  }
  if (!report.query.samples.some((sample) => sample.answer === FALTA_EL_DATO)) {
    hardFails.push(`query set must include an answer of "${FALTA_EL_DATO}"`);
  }

  if (report.cold.ms > CI_SOFT_COLD_MS) {
    softWarns.push(`cold ingest ${report.cold.ms.toFixed(0)} ms > soft ${CI_SOFT_COLD_MS} ms`);
  }
  if (report.query.p95Ms > CI_SOFT_QUERY_P95_MS) {
    softWarns.push(`query p95 ${report.query.p95Ms.toFixed(0)} ms > soft ${CI_SOFT_QUERY_P95_MS} ms`);
  }

  return { hardFails, softWarns };
}

export async function runBenchCli(argv: string[]): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: {
      fiches: { type: "string" },
      mode: { type: "string" },
      out: { type: "string" },
      ci: { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) {
    printBenchHelp();
    return 0;
  }

  const ci = Boolean(values.ci);
  const ficheCount = values.fiches
    ? Number(values.fiches)
    : ci
      ? DEFAULT_CI_FICHES
      : DEFAULT_BENCH_FICHES;
  if (!Number.isInteger(ficheCount) || ficheCount < 3) {
    console.error("--fiches must be an integer >= 3");
    return 1;
  }

  const mode = parseMode(values.mode ?? process.env.ATLAS_BENCH_MODE ?? "mock");
  if (!mode) {
    console.error("--mode must be mock or http");
    return 1;
  }
  if (ci && mode !== "mock") {
    console.error("--ci requires --mode mock");
    return 1;
  }

  const workDir = await mkdtemp(path.join(os.tmpdir(), "atlas-bench-"));

  const outPath = values.out ?? process.env.ATLAS_BENCH_OUT ?? DEFAULT_BENCH_OUT;
  const report = await runBench({
    destDir: workDir,
    ficheCount,
    mode,
    outPath,
  });
  console.log(formatBenchReport(report));
  console.log("");
  console.log(`Wrote ${outPath}`);

  if (ci) {
    const evalResult = evaluateBenchCi(report);
    for (const warn of evalResult.softWarns) {
      console.warn(`soft threshold: ${warn}`);
    }
    if (evalResult.hardFails.length > 0) {
      for (const fail of evalResult.hardFails) {
        console.error(`CI hard fail: ${fail}`);
      }
      return 1;
    }
    console.log(
      "CI smoke: hard checks passed (content_hash reuse + falta el dato). Soft timing gates do not fail CI.",
    );
  }
  return 0;
}

function parseMode(value: string): BenchMode | null {
  if (value === "mock" || value === "http") return value;
  return null;
}

function embeddingsForMode(mode: BenchMode): EmbeddingsClient {
  if (mode === "mock") return mockEmbeddingsClient();
  return createOpenAICompatibleEmbeddings(embeddingsConfigFromEnv());
}

function hostFiche(id: string): string {
  return `---
id: ${id}
kind: machine
title: Host de demostración ${id}
---

# ${id}

Máquina **sintética** de \`org-example\`. No representa infraestructura real.

## Especificaciones (fixture)

- vCPU: ${SYNTHETIC_VCPU}
- RAM_GB: ${SYNTHETIC_RAM_GB}
- disk_GB: ${SYNTHETIC_DISK_GB}
`;
}

function botFiche(id: string, hostId: string): string {
  return `---
id: ${id}
kind: bot
title: Bot sintético ${id}
---

# ${id}

Bot sintético de \`org-example\`. Corre en \`${hostId}\` (\`comes_from\`).

## Métricas en corpus

- max_context_tokens: ${SYNTHETIC_TOKENS}
`;
}

function roleFiche(id: string): string {
  return `---
id: ${id}
kind: role
title: Rol sintético ${id}
---

# ${id}

Rol sintético de \`org-example\`. No publica métricas de hardware ni de latencia.
`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function fmtMs(ms: number): string {
  return `${ms.toFixed(2)} ms`;
}

function truncate(text: string, max: number): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length <= max ? oneLine : `${oneLine.slice(0, max - 1)}…`;
}

function printBenchHelp(): void {
  console.log(`agent-context-atlas bench — synthetic corpus, machine-local timings

Uso:
  npm run bench -- [--fiches ${DEFAULT_BENCH_FICHES}] [--mode mock|http] [--out ${DEFAULT_BENCH_OUT}]
  npm run bench -- --ci

  --fiches   número de fichas sintéticas (default ${DEFAULT_BENCH_FICHES}, o ${DEFAULT_CI_FICHES} con --ci)
  --mode     mock (default, CI-safe) o http (OpenAI-compatible vía env)
  --out      escribe JSON (default ${DEFAULT_BENCH_OUT}, gitignored)
  --ci       humo rápido (mock, pocas fichas). Hard fail si el re-ingest no reusa
             embeddings o si ninguna query responde "${FALTA_EL_DATO}".
             Soft warn (no falla) si cold > ${CI_SOFT_COLD_MS} ms o query p95 > ${CI_SOFT_QUERY_P95_MS} ms.

Mide: ingestión en frío, re-ingest con content_hash, latencia p50/p95 de query
(incluye una pregunta que responde "${FALTA_EL_DATO}").

Variables (modo http): las mismas que el CLI — ATLAS_EMBEDDINGS_BASE_URL,
ATLAS_EMBEDDINGS_MODEL, ATLAS_EMBEDDINGS_API_KEY / OPENAI_API_KEY.
ATLAS_BENCH_MODE y ATLAS_BENCH_OUT equivalen a --mode y --out.

No es un SLA de producción. El bench local completo es \`npm run bench\` (sin --ci).`);
}
