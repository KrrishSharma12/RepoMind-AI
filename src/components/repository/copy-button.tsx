"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Copies the text of the element with the given id (the highlighted code, without line numbers). */
export function CopyButton({ targetId }: { targetId: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const text = document.getElementById(targetId)?.textContent ?? "";
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be blocked by the browser. Nothing else to do.
    }
  }

  const Icon = copied ? Check : Copy;

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-xs transition-colors hover:bg-panel"
    >
      <Icon className="size-3.5" aria-hidden="true" />
      <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}