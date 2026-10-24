import "server-only";
import type { GeminiContent } from "@/lib/ai/prompt";

/**
 * Streams an answer from Gemini over plain fetch (server-sent events).
 * The API key stays on the server and is never logged or put in a URL.
 */

const API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const MAX_OUTPUT_TOKENS = 2048;

export class ChatModelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChatModelError";
  }
}

interface StreamChunk {
  promptFeedback?: { blockReason?: string };
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
}

/** Turns one event from Gemini into text, or throws if the answer was blocked. */
function readChunk(raw: string, producedText: boolean): string[] {
  const data = raw
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");
  if (!data) return [];

  let chunk: StreamChunk;
  try {
    chunk = JSON.parse(data) as StreamChunk;
  } catch {
    return [];
  }

  if (chunk.promptFeedback?.blockReason) {
    throw new ChatModelError("Gemini's safety filters blocked this request. Try rephrasing the question.");
  }

  const out: string[] = [];
  const candidate = chunk.candidates?.[0];
  for (const part of candidate?.content?.parts ?? []) {
    if (typeof part.text === "string" && !part.thought) out.push(part.text);
  }

  const finish = candidate?.finishReason;
  if (finish === "MAX_TOKENS") out.push("\n\n_(The answer was cut off at the length limit. Ask a narrower question for more detail.)_");
  else if (finish && finish !== "STOP" && !producedText && out.length === 0) {
    throw new ChatModelError("Gemini did not return an answer for this request. Try rephrasing the question.");
  }
  return out;
}

function retryDelayMs(body: unknown): number | null {
  const details = (body as { error?: { details?: { retryDelay?: string }[] } })?.error?.details;
  const hint = details?.find((d) => typeof d.retryDelay === "string")?.retryDelay;
  const seconds = hint ? parseFloat(hint) : NaN;
  return Number.isFinite(seconds) ? Math.ceil(seconds * 1000) : null;
}

export async function* streamAnswer(input: {
  systemInstruction: string;
  contents: GeminiContent[];
  signal?: AbortSignal;
}): AsyncGenerator<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new ChatModelError("GEMINI_API_KEY is not set on the server.");
  // A blank value in .env counts as "not set", so the default is used.
  const model = process.env.LLM_MODEL?.trim() || "gemini-2.5-flash";

  let response: Response | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    response = await fetch(`${API_BASE}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: input.systemInstruction }] },
        contents: input.contents,
        generationConfig: { temperature: 0.2, maxOutputTokens: MAX_OUTPUT_TOKENS },
      }),
      signal: input.signal,
    }).catch((error: unknown) => {
      if (input.signal?.aborted) throw error;
      throw new ChatModelError("Could not reach the Gemini API.");
    });

    if (response.status !== 429 || attempt === 3) break;
    const delay = retryDelayMs(await response.json().catch(() => null));
    if (delay === null || delay > 20_000) break; // do not make the user wait long
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  if (!response || !response.ok) {
    const status = response?.status ?? 0;
    // Status only. The response body is never included in the message.
    throw new ChatModelError(
      status === 429
        ? "Gemini's rate limit or daily quota was reached. Wait a minute and try again."
        : status === 400 || status === 403
          ? `Gemini rejected the request (status ${status}). Check GEMINI_API_KEY.`
          : status === 404
            ? `Gemini does not know the model "${model}". Set LLM_MODEL to a model your key can use.`
            : `Gemini returned status ${status}.`,
    );
  }
  if (!response.body) throw new ChatModelError("Gemini returned an empty response.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let produced = false;

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
        for (const text of readChunk(raw, produced)) {
          produced = true;
          yield text;
        }
      }
    }
    if (buffer.trim()) {
      for (const text of readChunk(buffer, produced)) {
        produced = true;
        yield text;
      }
    }
  } finally {
    reader.cancel().catch(() => undefined);
  }
}