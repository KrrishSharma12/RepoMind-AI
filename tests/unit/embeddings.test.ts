import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMBEDDING_DIMENSIONS, EmbeddingError, embedDocuments, embedQuery } from "@/lib/ai/embeddings";
import { bodyOf, instantTimers, jsonResponse, mockFetch } from "../helpers";

const KEY = "SECRET-TEST-KEY-123";
const vector = (seed: number) => Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) => seed + i / 1000);

beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", KEY);
  vi.stubEnv("EMBED_RPM", "1000");
  vi.stubEnv("EMBED_TPM", "1000000");
});

describe("embedDocuments", () => {
  it("sends batches of 16, keeps the order, and puts the key only in a header", async () => {
    const fetchMock = mockFetch((_url, init) => {
      const { requests } = bodyOf(init);
      return jsonResponse({ embeddings: requests.map((r: { content: { parts: { text: string }[] } }) => ({ values: vector(Number(r.content.parts[0].text)) })) });
    });

    const texts = Array.from({ length: 40 }, (_, i) => String(i));
    const out = await embedDocuments(texts);

    expect(out).toHaveLength(40);
    out.forEach((v, i) => expect(v[0]).toBe(i));
    expect(fetchMock).toHaveBeenCalledTimes(3); // 16 + 16 + 8

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toContain("gemini-embedding-001:batchEmbedContents");
    expect(url).not.toContain("SECRET");
    expect(init.headers["x-goog-api-key"]).toBe(KEY);
    const first = bodyOf(init).requests[0];
    expect(first).toMatchObject({ taskType: "RETRIEVAL_DOCUMENT", outputDimensionality: 768, model: "models/gemini-embedding-001" });
  });

  it("retries after a 429 and honours the retry hint", async () => {
    const waits = instantTimers();
    let calls = 0;
    mockFetch((_url, init) => {
      calls++;
      if (calls === 1) return jsonResponse({ error: { details: [{ retryDelay: "1s" }] } }, 429);
      return jsonResponse({ embeddings: bodyOf(init).requests.map(() => ({ values: vector(1) })) });
    });
    await expect(embedDocuments(["a"])).resolves.toHaveLength(1);
    expect(calls).toBe(2);
    expect(waits).toContain(1000);
  });

  it("rejects embeddings with the wrong size or count", async () => {
    mockFetch(() => jsonResponse({ embeddings: [{ values: [1, 2, 3] }] }));
    await expect(embedDocuments(["a"])).rejects.toThrow(/unexpected shape/);
    mockFetch(() => jsonResponse({ embeddings: [] }));
    await expect(embedDocuments(["a", "b"])).rejects.toBeInstanceOf(EmbeddingError);
  });

  it("fails fast on 403 without leaking the key", async () => {
    const fetchMock = mockFetch(() => jsonResponse({ error: { message: `API key ${KEY} invalid` } }, 403));
    const error = await embedDocuments(["a"]).catch((e: Error) => e);
    expect(error).toBeInstanceOf(EmbeddingError);
    expect((error as Error).message).toContain("403");
    expect((error as Error).message).not.toContain("SECRET");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uses the default model when EMBEDDING_MODEL is blank in .env", async () => {
    vi.stubEnv("EMBEDDING_MODEL", "");
    const fetchMock = mockFetch((_url, init) => jsonResponse({ embeddings: bodyOf(init).requests.map(() => ({ values: vector(1) })) }));
    await embedDocuments(["a"]);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/models/gemini-embedding-001:batchEmbedContents");
  });

  it("explains a missing key", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    await expect(embedDocuments(["a"])).rejects.toThrow(/GEMINI_API_KEY is not set/);
  });

  it("turns network failures into a safe error", async () => {
    instantTimers();
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error(`socket hang up ${KEY}`))));
    const error = await embedDocuments(["a"]).catch((e: Error) => e);
    expect(error).toBeInstanceOf(EmbeddingError);
    expect((error as Error).message).not.toContain("SECRET");
  });
});

describe("embedQuery", () => {
  it("sends one RETRIEVAL_QUERY request and returns 768 numbers", async () => {
    const fetchMock = mockFetch(() => jsonResponse({ embeddings: [{ values: Array(768).fill(0.1) }] }));
    const result = await embedQuery("where is login?");
    expect(result).toHaveLength(768);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(bodyOf(init).requests).toHaveLength(1);
    expect(bodyOf(init).requests[0].taskType).toBe("RETRIEVAL_QUERY");
  });
});
