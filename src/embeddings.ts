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

const DEFAULT_MODEL = "text-embedding-3-small";
const DEFAULT_BASE_URL = "https://api.openai.com/v1";

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
  const baseUrl = env.ATLAS_EMBEDDINGS_BASE_URL?.trim() || DEFAULT_BASE_URL;
  const model = env.ATLAS_EMBEDDINGS_MODEL?.trim() || DEFAULT_MODEL;
  const apiKey = env.ATLAS_EMBEDDINGS_API_KEY?.trim() || env.OPENAI_API_KEY?.trim() || undefined;
  return { baseUrl, model, apiKey };
}

/**
 * OpenAI-compatible client: POST {baseUrl}/embeddings
 * (baseUrl should already include /v1, or /v1 is appended).
 *
 * Transient HTTP failures (429, 5xx) use 1 initial attempt + up to 2 retries
 * (3 HTTP calls max). Backoff is 50ms then 150ms. Other 4xx are not retried.
 */
export function createOpenAICompatibleEmbeddings(
  options: EmbeddingsClientOptions,
): EmbeddingsClient {
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
