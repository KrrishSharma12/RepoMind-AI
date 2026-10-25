import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateJson } from "@/lib/ai/gemini-json";
import { ChatModelError } from "@/lib/ai/gemini-chat";
import { bodyOf, instantTimers, jsonResponse, mockFetch } from "../helpers";

const KEY = "SECRET-TEST-KEY-123";
const contents = [{ role: "user" as const, parts: [{ text: "review" }] }];
const reply = (text: string, extra: object = {}) => jsonResponse({ candidates: [{ content: { parts: [{ text }] } }], ...extra });
const call = (responseSchema?: unknown) => generateJson({ systemInstruction: "sys", contents, responseSchema });

beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", KEY);
  vi.stubEnv("REVIEW_MODEL", "");
  vi.stubEnv("LLM_MODEL", "");
});

describe("generateJson", () => {
  it("asks for structured JSON and keeps the key in a header", async () => {
    const fetchMock = mockFetch(() => reply(JSON.stringify({ findings: [] })));
    await expect(call({ type: "OBJECT" })).resolves.toEqual({ findings: [] });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toContain(":generateContent");
    expect(url).not.toContain("stream");
    expect(url).not.toContain("SECRET");
    expect(init.headers["x-goog-api-key"]).toBe(KEY);
    expect(bodyOf(init).generationConfig).toMatchObject({ responseMimeType: "application/json", responseSchema: { type: "OBJECT" }, temperature: 0.1 });
    expect(bodyOf(init).systemInstruction.parts[0].text).toBe("sys");
  });

  it("uses REVIEW_MODEL when set", async () => {
    vi.stubEnv("REVIEW_MODEL", "review-model");
    const fetchMock = mockFetch(() => reply("{}"));
    await call();
    expect(String(fetchMock.mock.calls[0][0])).toContain("review-model:");
  });

  it("falls back through blank REVIEW_MODEL and LLM_MODEL to the default model", async () => {
    vi.stubEnv("REVIEW_MODEL", "");
    vi.stubEnv("LLM_MODEL", "  ");
    const fetchMock = mockFetch(() => reply("{}"));
    await call();
    expect(String(fetchMock.mock.calls[0][0])).toContain("/models/gemini-2.5-flash:generateContent");

    vi.stubEnv("LLM_MODEL", "chat-model");
    await call();
    expect(String(fetchMock.mock.calls[1][0])).toContain("/models/chat-model:generateContent");
  });

  it("tries again without the schema if the model rejects it", async () => {
    let calls = 0;
    const fetchMock = mockFetch(() => (calls++ === 0 ? jsonResponse({ error: { message: "schema unsupported" } }, 400) : reply('{"findings":[]}')));
    await expect(call({ type: "OBJECT" })).resolves.toEqual({ findings: [] });
    expect(bodyOf(fetchMock.mock.calls[0][1] as RequestInit).generationConfig.responseSchema).toBeDefined();
    const second = bodyOf(fetchMock.mock.calls[1][1] as RequestInit).generationConfig;
    expect(second.responseSchema).toBeUndefined();
    expect(second.responseMimeType).toBe("application/json");
  });

  it("copes with code fences, split parts, and hidden thoughts", async () => {
    mockFetch(() => reply('```json\n{"findings":[{"a":1}]}\n```'));
    await expect(call()).resolves.toEqual({ findings: [{ a: 1 }] });

    mockFetch(() => jsonResponse({ candidates: [{ content: { parts: [{ text: "hidden", thought: true }, { text: '{"findings":' }, { text: "[]}" }] } }] }));
    await expect(call()).resolves.toEqual({ findings: [] });
  });

  it.each([
    ["not json at all", () => reply("not json at all"), /unreadable format/],
    ["an empty reply", () => jsonResponse({ candidates: [{ content: { parts: [] } }] }), /empty response/],
    ["a safety block", () => jsonResponse({ promptFeedback: { blockReason: "SAFETY" } }), /safety filters/],
  ])("reports %s clearly", async (_name, response, pattern) => {
    mockFetch(response);
    await expect(call()).rejects.toThrow(pattern);
  });

  it.each([
    [404, /does not know the model/],
    [403, /status 403/],
    [429, /rate limit or daily quota/],
    [500, /status 500/],
  ])("gives a safe message for HTTP %i", async (status, pattern) => {
    instantTimers();
    mockFetch(() => jsonResponse({ error: { message: `key ${KEY} invalid` } }, status));
    const error = await call().catch((e: Error) => e);
    expect(error).toBeInstanceOf(ChatModelError);
    expect((error as Error).message).toMatch(pattern);
    expect((error as Error).message).not.toContain("SECRET");
  });

  it("retries a short rate-limit wait but not a long one, and needs a key", async () => {
    const waits = instantTimers();
    let calls = 0;
    mockFetch(() => (++calls === 1 ? jsonResponse({ error: { details: [{ retryDelay: "1s" }] } }, 429) : reply('{"findings":[]}')));
    await call();
    expect(calls).toBe(2);
    expect(waits).toContain(1000);

    calls = 0;
    mockFetch(() => {
      calls++;
      return jsonResponse({ error: { details: [{ retryDelay: "120s" }] } }, 429);
    });
    await expect(call()).rejects.toThrow(/rate limit/);
    expect(calls).toBe(1);

    vi.stubEnv("GEMINI_API_KEY", "");
    await expect(call()).rejects.toThrow(/GEMINI_API_KEY is not set/);
  });
});
