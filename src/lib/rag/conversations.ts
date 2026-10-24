import "server-only";
import { db } from "@/lib/db";
import type { ChatMessage, ConversationSummary, SourceRef } from "@/lib/chat/types";

export const CHAT_RATE_LIMIT_PER_MINUTE = 8;

/** The signed-in user's own copy of a repository, or null. Other users' rows never match. */
export async function findUserRepository(userId: string, owner: string, name: string) {
  return db.repository.findFirst({
    where: {
      userId,
      owner: { equals: owner, mode: "insensitive" },
      name: { equals: name, mode: "insensitive" },
    },
    select: { id: true, indexingStatus: true },
  });
}

export async function listConversations(userId: string, repositoryId: string): Promise<ConversationSummary[]> {
  const rows: { id: string; title: string; updatedAt: Date }[] = await db.conversation.findMany({
    where: { userId, repositoryId },
    orderBy: { updatedAt: "desc" },
    take: 30,
    select: { id: true, title: true, updatedAt: true },
  });
  return rows.map((row) => ({ id: row.id, title: row.title, updatedAt: row.updatedAt.toISOString() }));
}

function parseSources(value: unknown): SourceRef[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const sources = value.filter(
    (v): v is SourceRef =>
      typeof v?.path === "string" && typeof v?.startLine === "number" && typeof v?.endLine === "number" && typeof v?.cited === "boolean",
  );
  return sources.length > 0 ? sources : undefined;
}

/** Messages of one conversation, only if it belongs to this user and this repository. */
export async function getConversationMessages(
  userId: string,
  repositoryId: string,
  conversationId: string,
): Promise<ChatMessage[] | null> {
  const conversation = await db.conversation.findFirst({
    where: { id: conversationId, userId, repositoryId },
    select: { id: true },
  });
  if (!conversation) return null;

  const rows: { id: string; role: "USER" | "ASSISTANT"; content: string; sources: unknown }[] = await db.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  return rows.map((row) => ({ id: row.id, role: row.role, content: row.content, sources: parseSources(row.sources) }));
}