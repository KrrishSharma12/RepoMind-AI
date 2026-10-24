import type { StreamEvent } from "@/lib/chat/types";

const TYPES = new Set(["meta", "delta", "done", "error"]);

function parseEvent(raw: string): StreamEvent | null {
  const data = raw
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");
  if (!data) return null;
  try {
    const event = JSON.parse(data) as StreamEvent;
    return TYPES.has(event?.type) ? event : null;
  } catch {
    return null;
  }
}

/** Reads the server-sent events of a streamed answer, one event at a time. */
export async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<StreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      for (;;) {
        const match = /\r?\n\r?\n/.exec(buffer);
        if (!match) break;
        const raw = buffer.slice(0, match.index);
        buffer = buffer.slice(match.index + match[0].length);
        const event = parseEvent(raw);
        if (event) yield event;
      }
    }
    const tail = parseEvent(buffer);
    if (tail) yield tail;
  } finally {
    reader.cancel().catch(() => undefined);
  }
}