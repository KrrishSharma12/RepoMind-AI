import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatModelError, streamAnswer } from "@/lib/ai/gemini-chat";
import { bodyOf, instantTimers, jsonResponse, mockFetch, sse, streamOf } from "../helpers";

const KEY = "SECRET-TEST-KEY-123";
const contents = [{ role: "user" as const, parts: [{ text: "hi" }] }];
const textChunk = (text: string, extra: object = {}) => sse({ candidates: [{ content: { parts: [{ text }] }, ...extra }] });

async function collect(generator: AsyncGenerator<string>) {
  let text = "";
  for await (const piece of generator) text += piece;
  return text;
}
const run = () => collect(streamAnswer({ systemInstruction: "sys", contents }));
const streaming = (pieces: string[], status = 200) => mockFetch(() => new Response(streamOf(pieces), { status }));

beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", KEY);
  vi.stubEnv("LLM_MODEL", "");
});

describe("streamAnswer", () => {
  it("streams text, keeps the key in a header, and sends the system prompt separately", async () => {
    const fetchMock = streaming([textChunk("Hel"), textChunk("lo "), textChunk("world", { finishReason: "STOP" })]);
    await expect(run()).resolves.toBe("Hello world");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toContain(":streamGenerateContent?alt=sse");
    expect(url).toContain("gemini-2.5-flash");
    expect(url).not.toContain("SECRET");
    expect(init.headers["x-goog-api-key"]).toBe(KEY);
    expect(bodyOf(init).systemInstruction.parts[0].text).toBe("sys");
    expect(bodyOf(init).generationConfig.maxOutputTokens).toBe(2048);
  });

  it("reassembles events cut at arbitrary positions", async () => {
    const whole = textChunk("A") + textChunk("B") + textChunk("C");
    streaming([whole.slice(0, 5), whole.slice(5, 50), whole.slice(50, 51), whole.slice(51)]);
    await expect(run()).resolves.toBe("ABC");
  });

  it("does not show hidden thinking text", async () => {
    streaming([sse({ candidates: [{ content: { parts: [{ text: "thinking...", thought: true }, { text: "answer" }] } }] })]);
    await expect(run()).resolves.toBe("answer");
  });

  it("turns blocked requests into a clear error", async () => {
    streaming([sse({ promptFeedback: { blockReason: "SAFETY" } })]);
    await expect(run()).rejects.toThrow(/safety/i);
    streaming([sse({ candidates: [{ finishReason: "SAFETY" }] })]);
    await expect(run()).rejects.toBeInstanceOf(ChatModelError);
  });

  it("labels an answer that hit the length limit", async () => {
    streaming([textChunk("partial", { finishReason: "MAX_TOKENS" })]);
    const text = await run();
    expect(text.startsWith("partial")).toBe(true);
    expect(text).toMatch(/cut off/);
  });

  it.each([
    [404, /does not know the model/],
    [403, /status 403/],
    [429, /rate limit or daily quota/],
    [500, /status 500/],
  ])("gives a safe message for HTTP %i that never contains the key", async (status, pattern) => {
    mockFetch(() => jsonResponse({ error: { message: `key ${KEY} bad` } }, status));
    const error = await run().catch((e: Error) => e);
    expect(error).toBeInstanceOf(ChatModelError);
    expect((error as Error).message).toMatch(pattern);
    expect((error as Error).message).not.toContain("SECRET");
  });

  it("retries a short rate-limit wait but fails fast on a long one", async () => {
    const waits = instantTimers();
    let calls = 0;
    mockFetch(() => (++calls === 1 ? jsonResponse({ error: { details: [{ retryDelay: "1s" }] } }, 429) : new Response(streamOf([textChunk("ok")]))));
    await expect(run()).resolves.toBe("ok");
    expect(calls).toBe(2);
    expect(waits).toContain(1000);

    calls = 0;
    mockFetch(() => {
      calls++;
      return jsonResponse({ error: { details: [{ retryDelay: "90s" }] } }, 429);
    });
    await expect(run()).rejects.toThrow(/rate limit/);
    expect(calls).toBe(1);
  });

  it("reports a missing key and honours LLM_MODEL", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    await expect(run()).rejects.toThrow(/GEMINI_API_KEY is not set/);

    vi.stubEnv("GEMINI_API_KEY", KEY);
    vi.stubEnv("LLM_MODEL", "my-model");
    const fetchMock = streaming([textChunk("x")]);
    await run();
    expect(String(fetchMock.mock.calls[0][0])).toContain("models/my-model:");
  });

  it("stops when the user aborts and keeps what was already received", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: unknown, init: RequestInit) =>
        Promise.resolve(
          new Response(
            new ReadableStream({
              start(c) {
                c.enqueue(new TextEncoder().encode(textChunk("one")));
                init.signal!.addEventListener("abort", () => c.error(Object.assign(new Error("aborted"), { name: "AbortError" })));
              },
            }),
          ),
        ),
      ),
    );

    const seen: string[] = [];
    const attempt = (async () => {
      for await (const piece of streamAnswer({ systemInstruction: "s", contents, signal: controller.signal })) {
        seen.push(piece);
        controller.abort();
      }
    })();
    await expect(attempt).rejects.toMatchObject({ name: "AbortError" });
    expect(seen).toEqual(["one"]);
  });
});
