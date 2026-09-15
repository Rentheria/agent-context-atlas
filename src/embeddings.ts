export interface EmbeddingsConfig {
  baseUrl: string;
  model: string;
  apiKey?: string;
}

export interface EmbeddingsClient {
  readonly model: string;
  embed(texts: string[]): Promise<number[][]>;
}

export interface EmbeddingsClientOptions extends EmbeddingsConfig {
  fetchImpl?: typeof fetch;
  batchSize?: number;
  /** Test hook for retry backoff. Defaults to `setTimeout`. */
  sleep?: (ms: number) => Promise<void>;
}

export const DEFAULT_EMBEDDINGS_MODEL = "text-embedding-3-small";
export const DEFAULT_EMBEDDINGS_BASE_URL = "https://api.openai.com/v1";
/** Distinct model id so `--mock` ingest/query stay paired and never hit HTTP. */
export const MOCK_EMBEDDINGS_MODEL = "atlas-mock";
const DEFAULT_MOCK_DIM = 32;

/**
 * Bilingual, actionable message when cloud embeddings would run without a key
 * (or when the server replies 401). Never used as a raw OpenAI 401 dump.
 */
export const MISSING_EMBEDDINGS_CREDENTIALS_MESSAGE = [
  "Embeddings would call a cloud endpoint without an API key (or the server rejected the key).",
  "Set ATLAS_EMBEDDINGS_API_KEY (or OPENAI_API_KEY), or point ATLAS_EMBEDDINGS_BASE_URL at a local server (for example http://localhost:11434/v1).",
  "Configura ATLAS_EMBEDDINGS_API_KEY (o OPENAI_API_KEY), o apunta ATLAS_EMBEDDINGS_BASE_URL a un servidor local (por ejemplo http://localhost:11434/v1).",
  "Offline / sin red: atlas ingest --mock   ·   atlas query --mock \"...\"",
].join("\n");

/**
 * Extra HTTP attempts after the first failed request.
 * Total calls = 1 initial + up to {@link EMBEDDINGS_MAX_RETRIES} retries.
 * Only HTTP 429 and 5xx are retried; other 4xx are not.
 */
export const EMBEDDINGS_MAX_RETRIES = 2;
/** Short backoff before each retry (first retry 50ms, second 150ms). */
export const EMBEDDINGS_RETRY_BACKOFF_MS = [50, 150] as const;

export function embeddingsConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): EmbeddingsConfig {
  const baseUrl = env.ATLAS_EMBEDDINGS_BASE_URL?.trim() || DEFAULT_EMBEDDINGS_BASE_URL;
  const model = env.ATLAS_EMBEDDINGS_MODEL?.trim() || DEFAULT_EMBEDDINGS_MODEL;
  const apiKey = env.ATLAS_EMBEDDINGS_API_KEY?.trim() || env.OPENAI_API_KEY?.trim() || undefined;
  return { baseUrl, model, apiKey };
}

/** True when the embeddings URL is loopback / RFC1918 (no cloud API key required). */
export function isLocalEmbeddingsBaseUrl(baseUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    return false;
  }
  const host = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host === "::1") return true;
  return isLoopbackOrPrivateIpv4Host(host);
}

/** Loopback / RFC1918 without dotted-quad literals in source (public-tree guardrails). */
function isLoopbackOrPrivateIpv4Host(host: string): boolean {
  const parts = host.split(".");
  if (parts.length !== 4) return false;
  const octets = parts.map((part) => Number(part));
  if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const a = octets[0] ?? -1;
  const b = octets[1] ?? -1;
  if (a === 127) return true;
  if (a === 0 && octets.every((n) => n === 0)) return true;
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

export function embeddingsNeedCloudApiKey(config: EmbeddingsConfig): boolean {
  if (config.apiKey && config.apiKey.length > 0) return false;
  return !isLocalEmbeddingsBaseUrl(config.baseUrl);
}

export function assertEmbeddingsReady(config: EmbeddingsConfig): void {
  if (embeddingsNeedCloudApiKey(config)) {
    throw new Error(MISSING_EMBEDDINGS_CREDENTIALS_MESSAGE);
  }
}

/** Deterministic bag-of-words vector — no HTTP. Same idea as bench/test helpers. */
export function mockEmbeddingVector(text: string, dim = DEFAULT_MOCK_DIM): number[] {
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

/** Offline embeddings for `atlas ingest --mock` / `atlas query --mock`. */
export function createMockEmbeddings(model = MOCK_EMBEDDINGS_MODEL): EmbeddingsClient {
  return {
    model,
    async embed(texts: string[]): Promise<number[][]> {
      return texts.map((text) => mockEmbeddingVector(text));
    },
  };
}

/**
 * OpenAI-compatible client: POST {baseUrl}/embeddings
 * (baseUrl should already include /v1, or /v1 is appended).
 *
 * Transient HTTP failures (429, 5xx) use 1 initial attempt + up to 2 retries
 * (3 HTTP calls max). Backoff is 50ms then 150ms. Other 4xx are not retried.
 * HTTP 401 is rewritten to {@link MISSING_EMBEDDINGS_CREDENTIALS_MESSAGE}.
 */
export function createOpenAICompatibleEmbeddings(
  options: EmbeddingsClientOptions,
): EmbeddingsClient {
  assertEmbeddingsReady(options);
  const fetchImpl = options.fetchImpl ?? fetch;
  const batchSize = options.batchSize ?? 64;
  const sleep = options.sleep ?? defaultSleep;
  const url = embeddingsUrl(options.baseUrl);

  return {
    model: options.model,
    async embed(texts: string[]): Promise<number[][]> {
      if (texts.length === 0) return [];
      const vectors: number[][] = [];
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const embeddings = await embedBatch(
          fetchImpl,
          url,
          options.model,
          options.apiKey,
          batch,
          sleep,
        );
        vectors.push(...embeddings);
      }
      return vectors;
    },
  };
}

export function embeddingsUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  if (trimmed.endsWith("/embeddings")) return trimmed;
  if (trimmed.endsWith("/v1")) return `${trimmed}/embeddings`;
  return `${trimmed}/v1/embeddings`;
}

function isRetryableEmbeddingsStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

export function formatEmbeddingsHttpError(
  status: number,
  statusText: string,
  detail: string,
): string {
  const statusLabel = [String(status), statusText.trim()].filter(Boolean).join(" ");
  return `Embeddings HTTP ${statusLabel}: ${detail}`;
}

async function embedBatch(
  fetchImpl: typeof fetch,
  url: string,
  model: string,
  apiKey: string | undefined,
  input: string[],
  sleep: (ms: number) => Promise<void>,
): Promise<number[][]> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const maxAttempts = 1 + EMBEDDINGS_MAX_RETRIES;
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetchImpl(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ model, input }),
    });

    if (response.ok) {
      const payload: unknown = await response.json();
      return parseEmbeddingsResponse(payload, input.length);
    }

    if (response.status === 401) {
      throw new Error(MISSING_EMBEDDINGS_CREDENTIALS_MESSAGE);
    }
    const detail = await safeText(response);
    lastError = new Error(formatEmbeddingsHttpError(response.status, response.statusText, detail));
    const canRetry = isRetryableEmbeddingsStatus(response.status) && attempt < maxAttempts;
    if (!canRetry) {
      throw lastError;
    }
    const backoff = EMBEDDINGS_RETRY_BACKOFF_MS[attempt - 1] ?? EMBEDDINGS_RETRY_BACKOFF_MS.at(-1) ?? 50;
    await sleep(backoff);
  }

  throw lastError ?? new Error("Embeddings request failed");
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function parseEmbeddingsResponse(payload: unknown, expected: number): number[][] {
  if (!payload || typeof payload !== "object" || !("data" in payload)) {
    throw new Error("Embeddings response missing data[]");
  }
  const data = (payload as { data: unknown }).data;
  if (!Array.isArray(data)) {
    throw new Error("Embeddings response data is not an array");
  }

  const sorted = [...data].sort((a, b) => {
    const ia = isRecord(a) && typeof a.index === "number" ? a.index : 0;
    const ib = isRecord(b) && typeof b.index === "number" ? b.index : 0;
    return ia - ib;
  });

  const vectors = sorted.map((item, i) => {
    if (!isRecord(item) || !Array.isArray(item.embedding)) {
      throw new Error(`Embeddings response item ${i} has no embedding[]`);
    }
    return item.embedding.map((value) => {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(`Embeddings response item ${i} has a non-numeric component`);
      }
      return value;
    });
  });

  if (vectors.length !== expected) {
    throw new Error(`Expected ${expected} embeddings, got ${vectors.length}`);
  }
  return vectors;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

async function safeText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 500);
  } catch {
    return "";
  }
}
