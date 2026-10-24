import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { EmbeddingError } from "@/lib/ai/embeddings";
import { ChatModelError, streamAnswer } from "@/lib/ai/gemini-chat";
import { buildPrompt, type HistoryMessage } from "@/lib/ai/prompt";
import type { SourceRef, StreamEvent } from "@/lib/chat/types";
import { findCitedSources } from "@/lib/rag/citations";
import { CHAT_RATE_LIMIT_PER_MINUTE, findUserRepository } from "@/lib/rag/conversations";
import { toJson } from "@/lib/json";
import { retrieveChunks } from "@/lib/rag/retrieve";
import { isValidRepoPart } from "@/lib/repo/validate";
import { isSameOrigin } from "@/lib/security/origin";

const MAX_QUESTION_CHARS = 2000;
const ANSWER_TIMEOUT_MS = 90_000;

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

function parseBody(raw: unknown) {
  if (typeof raw !== "object" || raw === null) return null;
  const body = raw as { conversationId?: unknown; message?: unknown; regenerate?: unknown };

  const conversationId = body.conversationId === undefined || body.conversationId === null ? null : body.conversationId;
  if (conversationId !== null && (typeof conversationId !== "string" || !/^[A-Za-z0-9_-]{1,40}$/.test(conversationId))) return null;

  const regenerate = body.regenerate === true;
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!regenerate && (message.length === 0 || message.length > MAX_QUESTION_CHARS)) return null;
  if (regenerate && conversationId === null) return null;

  return { conversationId: conversationId as string | null, message, regenerate };
}

function safeMessage(error: unknown): string {
  if (error instanceof ChatModelError || error instanceof EmbeddingError) return error.message;
  return "Something went wrong while answering. Please try again.";
}

/** Streams an answer grounded in the user's indexed code. */
export async function POST(request: Request, { params }: { params: Promise<{ owner: string; name: string }> }) {
  if (!isSameOrigin(request)) return fail("Request origin not allowed.", 403);

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return fail("Please sign in.", 401);
  const userId = session.user.id;

  const { owner, name } = await params;
  if (!isValidRepoPart(owner) || !isValidRepoPart(name)) return fail("Invalid repository.", 400);

  const body = parseBody(await request.json().catch(() => null));
  if (!body) return fail(`Send a message of 1 to ${MAX_QUESTION_CHARS} characters.`, 400);

  // Simple per-user rate limit so one person cannot use up the free Gemini quota.
  const recent = await db.message.count({
    where: { role: "USER", createdAt: { gt: new Date(Date.now() - 60_000) }, conversation: { userId } },
  });
  if (recent >= CHAT_RATE_LIMIT_PER_MINUTE) return fail("You are sending questions too quickly. Wait a moment and try again.", 429);

  // The repository must be the signed-in user's own and must already be indexed.
  const repository = await findUserRepository(userId, owner, name);
  if (!repository) return fail("Index this repository first.", 409);
  const chunkCount = await db.codeChunk.count({ where: { repositoryId: repository.id } });
  if (chunkCount === 0) return fail("Index this repository first.", 409);

  // Find or create the conversation, always scoped to this user and repository.
  let conversationId = body.conversationId;
  let question = body.message;
  let history: HistoryMessage[] = [];

  if (conversationId) {
    const existing = await db.conversation.findFirst({ where: { id: conversationId, userId, repositoryId: repository.id }, select: { id: true } });
    if (!existing) return fail("Conversation not found.", 404);

    const messages: { id: string; role: "USER" | "ASSISTANT"; content: string }[] = await db.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      take: 200,
      select: { id: true, role: true, content: true },
    });

    if (body.regenerate) {
      // Drop the last answer (if any) and answer the last question again.
      if (messages.at(-1)?.role === "ASSISTANT") await db.message.delete({ where: { id: messages.pop()!.id } });
      const lastQuestion = messages.at(-1);
      if (!lastQuestion || lastQuestion.role !== "USER") return fail("There is no question to answer again.", 400);
      question = lastQuestion.content;
      messages.pop();
    }
    history = messages.map((m) => ({ role: m.role, content: m.content }));
  } else {
    const created = await db.conversation.create({
      data: { userId, repositoryId: repository.id, title: question.slice(0, 60) },
      select: { id: true },
    });
    conversationId = created.id;
  }

  if (!conversationId) return fail("Could not start the conversation.", 500);

  if (!body.regenerate) {
    await db.message.create({ data: { conversationId, role: "USER", content: question } });
  }

  const previousQuestion = [...history].reverse().find((m) => m.role === "USER")?.content;
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(ANSWER_TIMEOUT_MS)]);
  const encoder = new TextEncoder();
  const activeConversationId = conversationId;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // The browser disconnected. Nothing to send to.
        }
      };

      let answer = "";
      let sources: SourceRef[] = [];
      let used: { path: string; startLine: number; endLine: number }[] = [];

      try {
        // Tell the browser which conversation this is before the slow work starts.
        send({ type: "meta", conversationId: activeConversationId, sources: [] });
        const chunks = await retrieveChunks({ repositoryId: repository.id, question, previousQuestion });
        const prompt = buildPrompt({ question, history, chunks });
        used = prompt.usedChunks;
        sources = findCitedSources("", used);
        send({ type: "meta", conversationId: activeConversationId, sources });

        for await (const text of streamAnswer({ systemInstruction: prompt.systemInstruction, contents: prompt.contents, signal })) {
          answer += text;
          send({ type: "delta", text });
        }

        if (!answer.trim()) throw new ChatModelError("The model returned an empty answer. Please try again.");
        sources = findCitedSources(answer, used);
        send({ type: "done", sources });
      } catch (error) {
        if (!request.signal.aborted) {
          // Log the kind of error only, never keys, tokens, or code.
          console.error("Chat failed", { error: error instanceof Error ? error.name : "unknown" });
          send({ type: "error", message: signal.aborted ? "The answer took too long. Please try again." : safeMessage(error) });
        }
      } finally {
        // Keep whatever was written, even if the user pressed Stop.
        if (answer.trim()) {
          await db.message
            .create({
              data: { conversationId: activeConversationId, role: "ASSISTANT", content: answer, sources: toJson(findCitedSources(answer, used)) },
            })
            .catch(() => undefined);
        }
        await db.conversation.update({ where: { id: activeConversationId }, data: { updatedAt: new Date() } }).catch(() => undefined);
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}