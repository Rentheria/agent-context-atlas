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
}

const DEFAULT_MODEL = "text-embedding-3-small";
const DEFAULT_BASE_URL = "https://api.openai.com/v1";

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
 */
export function createOpenAICompatibleEmbeddings(
  options: EmbeddingsClientOptions,
): EmbeddingsClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const batchSize = options.batchSize ?? 64;
  const url = embeddingsUrl(options.baseUrl);

  return {
    model: options.model,
    async embed(texts: string[]): Promise<number[][]> {
      if (texts.length === 0) return [];
      const vectors: number[][] = [];
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const embeddings = await embedBatch(fetchImpl, url, options.model, options.apiKey, batch);
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

async function embedBatch(
  fetchImpl: typeof fetch,
  url: string,
  model: string,
  apiKey: string | undefined,
  input: string[],
): Promise<number[][]> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const response = await fetchImpl(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ model, input }),
  });

  if (!response.ok) {
    const detail = await safeText(response);
    throw new Error(`Embeddings HTTP ${response.status} ${response.statusText}: ${detail}`);
  }

  const payload: unknown = await response.json();
  return parseEmbeddingsResponse(payload, input.length);
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
