import "server-only";
import { ChatModelError } from "@/lib/ai/gemini-chat";
import type { GeminiContent } from "@/lib/ai/prompt";

/**
 * Asks Gemini for a structured JSON answer (not streamed). The key stays on the server,
 * only in a header, and error messages carry a status code, never the response body.
 */

const API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const MAX_OUTPUT_TOKENS = 4096;

function retryDelayMs(body: unknown): number | null {
  const details = (body as { error?: { details?: { retryDelay?: string }[] } })?.error?.details;
  const hint = details?.find((d) => typeof d.retryDelay === "string")?.retryDelay;
  const seconds = hint ? parseFloat(hint) : NaN;
  return Number.isFinite(seconds) ? Math.ceil(seconds * 1000) : null;
}

/** Some models wrap JSON in a code fence even when asked not to. */
function stripFence(text: string): string {
  const match = /^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/i.exec(text);
  return match ? match[1] : text;
}

export async function generateJson(input: {
  systemInstruction: string;
  contents: GeminiContent[];
  responseSchema?: unknown;
  signal?: AbortSignal;
}): Promise<unknown> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new ChatModelError("GEMINI_API_KEY is not set on the server.");
  // A blank value in .env counts as "not set", so the next choice is used.
  const model = process.env.REVIEW_MODEL?.trim() || process.env.LLM_MODEL?.trim() || "gemini-2.5-flash";
  const url = `${API_BASE}/models/${encodeURIComponent(model)}:generateContent`;

  const send = (withSchema: boolean) =>
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: input.systemInstruction }] },
        contents: input.contents,
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          responseMimeType: "application/json",
          ...(withSchema && input.responseSchema ? { responseSchema: input.responseSchema } : {}),
        },
      }),
      signal: input.signal,
    }).catch((error: unknown) => {
      if (input.signal?.aborted) throw error;
      throw new ChatModelError("Could not reach the Gemini API.");
    });

  let withSchema = true;
  let response = await send(withSchema);

  for (let attempt = 1; attempt <= 3 && !response.ok; attempt++) {
    if (response.status === 400 && withSchema) {
      // Some models reject a response schema. Try again, relying on the prompt for the format.
      withSchema = false;
      response = await send(withSchema);
      continue;
    }
    if (response.status === 429 || response.status >= 500) {
      const delay = response.status === 429 ? retryDelayMs(await response.json().catch(() => null)) : 2000;
      if (delay === null || delay > 20_000) break;
      await new Promise((resolve) => setTimeout(resolve, delay));
      response = await send(withSchema);
      continue;
    }
    break;
  }

  if (!response.ok) {
    const status = response.status;
    throw new ChatModelError(
      status === 429
        ? "Gemini's rate limit or daily quota was reached."
        : status === 400 || status === 403
          ? `Gemini rejected the request (status ${status}). Check GEMINI_API_KEY.`
          : status === 404
            ? `Gemini does not know the model "${model}". Set REVIEW_MODEL or LLM_MODEL to a model your key can use.`
            : `Gemini returned status ${status}.`,
    );
  }

  const data = (await response.json()) as {
    promptFeedback?: { blockReason?: string };
    candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
  };
  if (data.promptFeedback?.blockReason) throw new ChatModelError("Gemini's safety filters blocked this request.");

  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .filter((part) => typeof part.text === "string" && !part.thought)
    .map((part) => part.text)
    .join("");
  if (!text.trim()) throw new ChatModelError("Gemini returned an empty response.");

  try {
    return JSON.parse(stripFence(text));
  } catch {
    throw new ChatModelError("Gemini returned a review in an unreadable format.");
  }
}