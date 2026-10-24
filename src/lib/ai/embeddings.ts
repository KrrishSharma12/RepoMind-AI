import "server-only";

/**
 * Gemini embeddings over plain fetch, with pacing for the free tier's limits.
 * The API key is read on the server only and never logged.
 */

const API_BASE = "https://generativelanguage.googleapis.com/v1beta";
export const EMBEDDING_DIMENSIONS = 768; // must match vector(768) in the database
const BATCH_SIZE = 16;
const MAX_ATTEMPTS = 5;

export class EmbeddingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmbeddingError";
  }
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4); // rough: about 4 characters per token
}

function envNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Keeps us under the requests-per-minute and tokens-per-minute limits. */
class RateLimiter {
  private events: { time: number; tokens: number }[] = [];

  async acquire(tokens: number): Promise<void> {
    const maxTokens = envNumber("EMBED_TPM", 20_000);
    const maxRequests = envNumber("EMBED_RPM", 60);
    const cost = Math.min(tokens, maxTokens); // one big request must still be able to run

    for (;;) {
      const now = Date.now();
      this.events = this.events.filter((event) => now - event.time < 60_000);
      const usedTokens = this.events.reduce((sum, event) => sum + event.tokens, 0);

      if (this.events.length < maxRequests && usedTokens + cost <= maxTokens) {
        this.events.push({ time: now, tokens: cost });
        return;
      }
      const oldest = this.events[0];
      const wait = oldest ? Math.max(250, 60_000 - (now - oldest.time) + 50) : 1000;
      await new Promise((resolve) => setTimeout(resolve, Math.min(wait, 5000)));
    }
  }
}

const limiter = new RateLimiter();

function retryDelayFromBody(body: unknown): number | null {
  // Google's 429 body can include a retry hint such as "retryDelay": "23s".
  const details = (body as { error?: { details?: { retryDelay?: string }[] } })?.error?.details;
  const hint = details?.find((d) => typeof d.retryDelay === "string")?.retryDelay;
  const seconds = hint ? parseFloat(hint) : NaN;
  return Number.isFinite(seconds) ? Math.ceil(seconds * 1000) : null;
}

type TaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

async function embedBatch(texts: string[], taskType: TaskType): Promise<number[][]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new EmbeddingError("GEMINI_API_KEY is not set on the server.");
  // A blank value in .env counts as "not set", so the default is used.
  const model = process.env.EMBEDDING_MODEL?.trim() || "gemini-embedding-001";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let response: Response;
    try {
      response = await fetch(`${API_BASE}/models/${model}:batchEmbedContents`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          requests: texts.map((text) => ({
            model: `models/${model}`,
            content: { parts: [{ text }] },
            taskType,
            outputDimensionality: EMBEDDING_DIMENSIONS,
          })),
        }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      if (attempt === MAX_ATTEMPTS) throw new EmbeddingError("Could not reach the Gemini API.");
      await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
      continue;
    }

    if (response.ok) {
      const data = (await response.json()) as { embeddings?: { values?: number[] }[] };
      const vectors = data.embeddings?.map((e) => e.values ?? []) ?? [];
      if (vectors.length !== texts.length || vectors.some((v) => v.length !== EMBEDDING_DIMENSIONS)) {
        throw new EmbeddingError("Gemini returned embeddings in an unexpected shape.");
      }
      return vectors;
    }

    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable) {
      // Status only. The response body is not included in the message.
      throw new EmbeddingError(
        response.status === 400 || response.status === 403
          ? `Gemini rejected the request (status ${response.status}). Check GEMINI_API_KEY and the model name.`
          : `Gemini returned status ${response.status}.`,
      );
    }
    if (attempt === MAX_ATTEMPTS) {
      throw new EmbeddingError(
        response.status === 429
          ? "Gemini rate limit or daily quota reached. Try again later."
          : `Gemini is unavailable (status ${response.status}).`,
      );
    }

    const body = await response.json().catch(() => null);
    const delay = retryDelayFromBody(body) ?? Math.min(60_000, 2000 * 2 ** attempt);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  throw new EmbeddingError("Embedding failed.");
}

/** Embeds many texts, in paced batches. Returns one 768-number vector per text, in order. */
export async function embedDocuments(texts: string[]): Promise<number[][]> {
  const vectors: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    await limiter.acquire(batch.reduce((sum, text) => sum + estimateTokens(text), 0));
    vectors.push(...(await embedBatch(batch, "RETRIEVAL_DOCUMENT")));
  }
  return vectors;
}

/** Embeds a user's question so it can be compared with the stored code pieces. */
export async function embedQuery(text: string): Promise<number[]> {
  await limiter.acquire(estimateTokens(text));
  const [vector] = await embedBatch([text], "RETRIEVAL_QUERY");
  return vector;
}