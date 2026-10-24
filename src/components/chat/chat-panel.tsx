"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Send, Square } from "lucide-react";
import { MessageView } from "@/components/chat/message-view";
import { readEvents } from "@/lib/chat/stream-client";
import type { ChatMessage, ConversationSummary } from "@/lib/chat/types";

// Ids for messages that exist only in the browser until the server saves them.
let localMessageCounter = 0;
function newLocalId(prefix: string): string {
  localMessageCounter += 1;
  return `${prefix}-${localMessageCounter}`;
}

const SUGGESTIONS = [
  "Explain this project in simple terms.",
  "Where is authentication implemented?",
  "What is the overall architecture and how do the main parts connect?",
  "Find potential bugs or security problems in the main code paths.",
];

interface ChatPanelProps {
  owner: string;
  name: string;
  baseHref: string;
  initialConversations: ConversationSummary[];
  initialConversationId: string | null;
  initialMessages: ChatMessage[];
}

export function ChatPanel({ owner, name, baseHref, initialConversations, initialConversationId, initialMessages }: ChatPanelProps) {
  const api = `/api/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;

  const [conversations, setConversations] = useState(initialConversations);
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const conversationRef = useRef<string | null>(initialConversationId);

  // Keep the newest text in view while an answer streams, unless the reader scrolled up.
  useEffect(() => {
    const list = listRef.current;
    if (list && stickToBottom.current) list.scrollTop = list.scrollHeight;
  }, [messages]);

  useEffect(() => () => abortRef.current?.abort(), []);

  function patchMessage(id: string, patch: (message: ChatMessage) => Partial<ChatMessage>) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch(m) } : m)));
  }

  async function refreshConversations() {
    try {
      const response = await fetch(`${api}/conversations`, { cache: "no-store" });
      if (response.ok) setConversations(((await response.json()) as { conversations: ConversationSummary[] }).conversations);
    } catch {
      // The list will refresh next time.
    }
  }

  async function run(request: { message?: string; regenerate?: boolean }) {
    setError(null);
    setStreaming(true);
    stickToBottom.current = true;

    const controller = new AbortController();
    abortRef.current = controller;
    const pendingId = newLocalId("pending");
    const userId = newLocalId("user");

    setMessages((prev) => {
      const base = request.regenerate && prev.at(-1)?.role === "ASSISTANT" ? prev.slice(0, -1) : prev;
      const user: ChatMessage[] = request.message ? [{ id: userId, role: "USER", content: request.message }] : [];
      return [...base, ...user, { id: pendingId, role: "ASSISTANT", content: "" }];
    });

    let savedOnServer = false;
    try {
      const response = await fetch(`${api}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: conversationRef.current, ...request }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        // Rejected before anything was saved: undo the optimistic messages and give the text back.
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setMessages((prev) => prev.filter((m) => m.id !== pendingId && m.id !== userId));
        if (request.message) setInput(request.message);
        setError(data.error ?? "Could not get an answer.");
        return;
      }

      for await (const event of readEvents(response.body)) {
        if (event.type === "meta") {
          savedOnServer = true;
          conversationRef.current = event.conversationId;
          setConversationId(event.conversationId);
          patchMessage(pendingId, () => ({ sources: event.sources }));
        } else if (event.type === "delta") {
          patchMessage(pendingId, (m) => ({ content: m.content + event.text }));
        } else if (event.type === "done") {
          patchMessage(pendingId, () => ({ sources: event.sources }));
        } else if (event.type === "error") {
          setError(event.message);
        }
      }
    } catch (caught) {
      if ((caught as Error).name !== "AbortError") {
        setError("The connection was interrupted. Please try again.");
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
      // An empty placeholder (nothing was written) is removed. A partial answer stays.
      setMessages((prev) => prev.filter((m) => !(m.id === pendingId && m.content === "")));
      if (savedOnServer) refreshConversations();
    }
  }

  function submit(text: string) {
    const message = text.trim();
    if (!message || streaming) return;
    setInput("");
    void run({ message });
  }

  function newConversation() {
    abortRef.current?.abort();
    conversationRef.current = null;
    setConversationId(null);
    setMessages([]);
    setError(null);
    setInput("");
  }

  async function openConversation(id: string) {
    if (!id) return newConversation();
    abortRef.current?.abort();
    setError(null);
    try {
      const response = await fetch(`${api}/conversations/${encodeURIComponent(id)}`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      const data = (await response.json()) as { messages: ChatMessage[] };
      conversationRef.current = id;
      setConversationId(id);
      setMessages(data.messages);
      stickToBottom.current = true;
    } catch {
      setError("Could not open that conversation.");
    }
  }

  const lastAssistantIndex = messages.map((m) => m.role).lastIndexOf("ASSISTANT");
  const canRetry = error !== null && conversationId !== null && !streaming;

  return (
    <div className="flex h-[75vh] min-h-120 flex-col rounded-xl border border-line">
      <div className="flex items-center gap-2 border-b border-line p-3">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Conversation history</span>
          <select
            value={conversationId ?? ""}
            onChange={(e) => void openConversation(e.target.value)}
            className="w-full truncate rounded-lg border border-line bg-bg px-2.5 py-2 text-sm"
          >
            <option value="">{conversationId === null ? "New conversation" : "Start a new conversation"}</option>
            {conversations.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={newConversation}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm transition-colors hover:bg-panel"
        >
          <Plus className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">New</span>
          <span className="sr-only sm:hidden">New conversation</span>
        </button>
      </div>

      <div
        ref={listRef}
        role="log"
        aria-label="Conversation"
        aria-busy={streaming}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="flex-1 space-y-6 overflow-y-auto p-4"
      >
        {messages.length === 0 ? (
          <div className="mx-auto max-w-xl py-6">
            <h2 className="text-lg font-medium">Ask about this repository</h2>
            <p className="mt-1 text-sm text-muted">Answers come from your indexed code and link to the files they use.</p>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((question) => (
                <li key={question}>
                  <button
                    type="button"
                    onClick={() => submit(question)}
                    className="h-full w-full rounded-lg border border-line p-3 text-left text-sm transition-colors hover:bg-panel"
                  >
                    {question}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          messages.map((message, index) => (
            <MessageView
              key={message.id}
              message={message}
              baseHref={baseHref}
              pending={streaming && index === messages.length - 1 && message.role === "ASSISTANT"}
              canRegenerate={!streaming && index === lastAssistantIndex && index === messages.length - 1}
              onRegenerate={() => void run({ regenerate: true })}
            />
          ))
        )}
      </div>

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-danger/10 px-4 py-2.5 text-sm">
          <span>{error}</span>
          {canRetry && (
            <button type="button" onClick={() => void run({ regenerate: true })} className="rounded-md border border-line px-2.5 py-1 text-xs hover:bg-panel">
              Retry
            </button>
          )}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
        className="flex items-end gap-2 border-t border-line p-3"
      >
        <label className="min-w-0 flex-1">
          <span className="sr-only">Ask a question about this repository</span>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit(input);
              }
            }}
            rows={2}
            maxLength={2000}
            placeholder="Ask a question. Enter to send, Shift+Enter for a new line."
            className="w-full resize-none rounded-lg border border-line bg-transparent px-3 py-2 text-sm placeholder:text-muted"
          />
        </label>
        {streaming ? (
          <button
            type="button"
            onClick={() => abortRef.current?.abort()}
            className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2.5 text-sm transition-colors hover:bg-panel"
          >
            <Square className="size-4" aria-hidden="true" />
            Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={input.trim() === ""}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2.5 text-sm font-medium text-accent-fg transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Send className="size-4" aria-hidden="true" />
            Send
          </button>
        )}
      </form>
    </div>
  );
} 