#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import { doctorCorpus, formatDoctorReport } from "./doctor.js";
import type { EmbeddingsClient } from "./embeddings.js";
import { createOpenAICompatibleEmbeddings, embeddingsConfigFromEnv } from "./embeddings.js";
import { loadFiches } from "./fiche.js";
import { buildGraph, loadGraphFile, renderGraphDot, renderGraphMermaid } from "./graph.js";
import { ingest } from "./ingest.js";
import { query } from "./query.js";
import type { QueryResult } from "./types.js";

export interface CliDeps {
  embeddings?: EmbeddingsClient;
}

export function readPackageVersion(): string {
  const pkgPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: unknown };
  if (typeof pkg.version !== "string" || pkg.version.length === 0) {
    throw new Error("package.json is missing a version string");
  }
  return pkg.version;
}

export async function run(argv: string[], deps: CliDeps = {}): Promise<number> {
  const command = argv[0];
  if (command === "--version" || command === "-v") {
    console.log(readPackageVersion());
    return 0;
  }
  if (!command || command === "-h" || command === "--help" || command === "help") {
    printHelp();
    return command ? 0 : 1;
  }

  if (command === "ingest") {
    return runIngest(argv.slice(1), deps);
  }
  if (command === "query") {
    return runQuery(argv.slice(1), deps);
  }
  if (command === "doctor") {
    return runDoctor(argv.slice(1));
  }
  if (command === "graph") {
    return runGraph(argv.slice(1));
  }

  console.error(`Unknown command: ${command}`);
  printHelp();
  return 1;
}

async function runIngest(argv: string[], deps: CliDeps): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: {
      fiches: { type: "string" },
      graph: { type: "string" },
      index: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) {
    printHelp();
    return 0;
  }

  const embeddings = clientFromEnv(deps);
  const result = await ingest({
    fichesDir: values.fiches ?? "fixtures/fiches",
    graphPath: values.graph ?? "fixtures/graph.json",
    indexDir: values.index ?? ".atlas",
    embeddings,
  });

  console.log(
    `Ingest OK — ${result.ficheCount} fichas, ${result.chunkCount} chunks, ${result.embedded} embebidos, ${result.reused} reutilizados.`,
  );
  console.log(`Índice: ${result.indexPath}`);
  console.log(`Navegación (vista del grafo): ${result.navPath}`);
  console.log(`Grafo Mermaid: ${result.mermaidPath}`);
  return 0;
}

async function runQuery(argv: string[], deps: CliDeps): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      index: { type: "string" },
      json: { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) {
    printHelp();
    return 0;
  }

  const question = positionals.join(" ").trim();
  if (!question) {
    console.error('Uso: atlas query "..."');
    return 1;
  }

  const embeddings = clientFromEnv(deps);
  const result = await query({
    question,
    indexDir: values.index ?? ".atlas",
    embeddings,
  });

  if (values.json) {
    console.log(formatQueryJson(result));
    return 0;
  }

  console.log(result.answer);
  if (result.sources.length > 0) {
    console.log("");
    console.log(
      `Fuentes: ${unique(result.sources.map((source) => source.ficheId)).join(", ")}`,
    );
  }
  if (result.neighbors.length > 0) {
    console.log(`Vecinos: ${result.neighbors.join(", ")}`);
  }
  return 0;
}

async function runDoctor(argv: string[]): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: {
      fiches: { type: "string" },
      graph: { type: "string" },
      json: { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) {
    printHelp();
    return 0;
  }

  const report = await doctorCorpus({
    fichesDir: values.fiches ?? "fixtures/fiches",
    graphPath: values.graph ?? "fixtures/graph.json",
  });

  if (values.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatDoctorReport(report));
  }
  return report.ok ? 0 : 1;
}

async function runGraph(argv: string[]): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: {
      fiches: { type: "string" },
      graph: { type: "string" },
      format: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) {
    printHelp();
    return 0;
  }

  const format = values.format ?? "mermaid";
  if (format !== "mermaid" && format !== "dot") {
    console.error("Uso: atlas graph --format mermaid|dot");
    return 1;
  }

  const fichesDir = values.fiches ?? "fixtures/fiches";
  const graphPath = values.graph ?? "fixtures/graph.json";
  const fiches = await loadFiches(fichesDir);
  const extra = await loadGraphFile(graphPath);
  const graph = buildGraph(fiches, extra);
  const titles = Object.fromEntries(fiches.map((fiche) => [fiche.id, fiche.title]));
  const rendered = format === "dot" ? renderGraphDot(graph, titles) : renderGraphMermaid(graph, titles);
  console.log(rendered.trimEnd());
  return 0;
}

export function formatQueryJson(result: QueryResult): string {
  return `${JSON.stringify(result, null, 2)}\n`.trimEnd();
}

function clientFromEnv(deps: CliDeps): EmbeddingsClient {
  if (deps.embeddings) return deps.embeddings;
  const config = embeddingsConfigFromEnv();
  return createOpenAICompatibleEmbeddings(config);
}

function printHelp(): void {
  console.log(`agent-context-atlas — contexto de agentes/máquinas (no gasto)

Uso:
  atlas --version | -v
  atlas ingest [--fiches fixtures/fiches] [--graph fixtures/graph.json] [--index .atlas]
  atlas query "..." [--index .atlas] [--json]
  atlas doctor [--fiches fixtures/fiches] [--graph fixtures/graph.json] [--json]
  atlas graph [--fiches fixtures/fiches] [--graph fixtures/graph.json] [--format mermaid|dot]

Variables de entorno:
  ATLAS_EMBEDDINGS_BASE_URL   endpoint OpenAI-compatible (default https://api.openai.com/v1)
  ATLAS_EMBEDDINGS_MODEL      modelo de embeddings (default text-embedding-3-small)
  ATLAS_EMBEDDINGS_API_KEY    opcional; también acepta OPENAI_API_KEY

Regla: si una métrica no está en el corpus, la respuesta es exactamente: falta el dato
Solo fixtures sintéticos (host-demo-01, bot-alpha, role-coordinator, org-example, …).`);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function isMain(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(entry).href;
}

if (isMain()) {
  run(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(message);
      process.exitCode = 1;
    });
}
