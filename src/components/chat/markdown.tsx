"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";
import "highlight.js/styles/github-dark.css";

function CodeBlock({ children }: { children?: React.ReactNode }) {
  const ref = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(ref.current?.textContent ?? "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked by the browser.
    }
  }

  const Icon = copied ? Check : Copy;
  return (
    <div className="relative my-3 rounded-lg border border-line bg-black/30">
      <button
        type="button"
        onClick={copy}
        aria-label="Copy code"
        className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md border border-line bg-bg/80 px-2 py-1 text-xs transition-colors hover:bg-panel"
      >
        <Icon className="size-3" aria-hidden="true" />
        {copied ? "Copied" : "Copy"}
      </button>
      <pre ref={ref} className="overflow-x-auto p-3 pr-20 font-mono text-[0.8125rem] leading-relaxed">
        {children}
      </pre>
    </div>
  );
}

const components: Components = {
  p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
  h1: ({ children }) => <h3 className="mb-1 mt-4 text-base font-semibold">{children}</h3>,
  h2: ({ children }) => <h3 className="mb-1 mt-4 text-base font-semibold">{children}</h3>,
  h3: ({ children }) => <h4 className="mb-1 mt-3 font-semibold">{children}</h4>,
  h4: ({ children }) => <h4 className="mb-1 mt-3 font-semibold">{children}</h4>,
  blockquote: ({ children }) => <blockquote className="my-2 border-l-2 border-line pl-3 text-muted">{children}</blockquote>,
  hr: () => <hr className="my-4 border-line" />,
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-line px-2 py-1 font-medium">{children}</th>,
  td: ({ children }) => <td className="border border-line px-2 py-1">{children}</td>,
  pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
  code: ({ className, children }) =>
    className ? (
      <code className={className}>{children}</code>
    ) : (
      <code className="rounded bg-white/10 px-1 py-0.5 font-mono text-[0.85em]">{children}</code>
    ),
  a: ({ href, children }) =>
    href?.startsWith("/") ? (
      <Link href={href} prefetch={false} className="break-all font-mono text-[0.85em] text-accent underline-offset-4 hover:underline">
        {children}
      </Link>
    ) : (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent underline-offset-4 hover:underline">
        {children}
      </a>
    ),
};

/** Renders the model's Markdown. Raw HTML in the text is not rendered, so it cannot inject markup. */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="chat-markdown min-w-0 break-words text-sm">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}