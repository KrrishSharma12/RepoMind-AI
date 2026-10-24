import { ChatPanel } from "@/components/chat/chat-panel";
import { GlassCard } from "@/components/ui/glass-card";
import { findUserRepository, getConversationMessages, listConversations } from "@/lib/rag/conversations";

interface ChatSectionProps {
  userId: string;
  owner: string;
  name: string;
  baseHref: string;
  indexed: boolean;
}

/** Loads the user's saved conversations on the server, then hands them to the chat UI. */
export async function ChatSection({ userId, owner, name, baseHref, indexed }: ChatSectionProps) {
  const repository = indexed ? await findUserRepository(userId, owner, name) : null;

  if (!indexed || !repository) {
    return (
      <GlassCard className="p-6">
        <h2 className="text-lg font-medium">Index this repository first</h2>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">
          Chat answers come from your indexed code. Use the Index repository button at the top of this page, wait for it to
          finish, then come back to this tab.
        </p>
      </GlassCard>
    );
  }

  const conversations = await listConversations(userId, repository.id);
  const latestId = conversations[0]?.id ?? null;
  const messages = latestId ? ((await getConversationMessages(userId, repository.id, latestId)) ?? []) : [];

  return (
    <ChatPanel
      owner={owner}
      name={name}
      baseHref={baseHref}
      initialConversations={conversations}
      initialConversationId={latestId}
      initialMessages={messages}
    />
  );
}