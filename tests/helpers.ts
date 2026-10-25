import { vi } from "vitest";

/** A JSON Response, like fetch returns. */
export const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** A readable stream that delivers the given text pieces one at a time. */
export function streamOf(pieces: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      for (const piece of pieces) controller.enqueue(encoder.encode(piece));
      controller.close();
    },
  });
}

/** One server-sent event, the way Gemini sends them. */
export const sse = (value: unknown) => `data: ${JSON.stringify(value)}\r\n\r\n`;

/** Replaces fetch for one test. Returns the mock so the test can inspect the calls. */
export function mockFetch(handler: (url: string, init: RequestInit & { headers: Record<string, string> }) => Response | Promise<Response>) {
  const mock = vi.fn((url: unknown, init: unknown) => Promise.resolve(handler(String(url), init as RequestInit & { headers: Record<string, string> })));
  vi.stubGlobal("fetch", mock);
  return mock;
}

/** Makes waits instant, and records how long the code asked to wait. */
export function instantTimers() {
  const waits: number[] = [];
  vi.stubGlobal("setTimeout", (callback: () => void, ms?: number) => {
    waits.push(ms ?? 0);
    callback();
    return 0;
  });
  return waits;
}

/** The text of a request body, parsed. */
export const bodyOf = (init: RequestInit) => JSON.parse(init.body as string);
