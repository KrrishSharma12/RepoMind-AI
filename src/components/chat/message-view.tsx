"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Copy, RotateCw } from "lucide-react";
import { Markdown } from "@/components/chat/markdown";
import { linkifyCitations } from "@/lib/chat/linkify";
import type { ChatMessage, SourceRef } from "@/lib/chat/types";

function Sources({ sources, baseHref }: { sources: SourceRef[]; baseHref: string }) {
  const cited = sources.filter((s) => s.cited);
  const shown = cited.length > 0 ? cited : sources;
  if (shown.length === 0) return null;

  return (
    <div className="mt-3">
      <p className="mb-1.5 text-xs text-muted">{cited.length > 0 ? "Sources" : "Retrieved context (not directly cited)"}</p>
      <ul className="flex flex-wrap gap-2">
        {shown.map((s) => (
          <li key={`${s.path}:${s.startLine}-${s.endLine}`} className="max-w-full">
            <Link
              href={`${baseHref}?path=${encodeURIComponent(s.path)}`}
              prefetch={false}
              className="block max-w-full truncate rounded-md border border-line px-2 py-1 font-mono text-xs text-muted transition-colors hover:bg-panel hover:text-fg"
            >
              {s.path}:{s.startLine}-{s.endLine}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface MessageViewProps {
  message: ChatMessage;
  baseHref: string;
  pending: boolean;
  canRegenerate: boolean;
  onRegenerate: () => void;
}

export function MessageView({ message, baseHref, pending, canRegenerate, onRegenerate }: MessageViewProps) {
  const [copied, setCopied] = useState(false);

  if (message.role === "USER") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[90%] whitespace-pre-wrap break-words rounded-xl bg-accent/15 px-3.5 py-2.5 text-sm leading-relaxed">
          {message.content}
        </p>
      </div>
    );
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked by the browser.
    }
  }

  const text = linkifyCitations(
    message.content,
    (message.sources ?? []).map((s) => s.path),
    (path) => `${baseHref}?path=${encodeURIComponent(path)}`,
  );
  const Icon = copied ? Check : Copy;

  return (
    <div className="min-w-0">
      {message.content === "" ? (
        <p className="text-sm text-muted">{pending ? "Searching your code..." : ""}</p>
      ) : (
        <Markdown>{text}</Markdown>
      )}

      {message.sources && !pending && <Sources sources={message.sources} baseHref={baseHref} />}

      {!pending && message.content !== "" && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-xs transition-colors hover:bg-panel"
          >
            <Icon className="size-3.5" aria-hidden="true" />
            {copied ? "Copied" : "Copy answer"}
          </button>
          {canRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-xs transition-colors hover:bg-panel"
            >
              <RotateCw className="size-3.5" aria-hidden="true" />
              Regenerate
            </button>
          )}
        </div>
      )}
    </div>
  );
}