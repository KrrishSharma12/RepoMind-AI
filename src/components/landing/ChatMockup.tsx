import { CHAT_MOCK as c, FILE_TREE } from "@/lib/constants/landing";
import { FileTree } from "@/components/landing/FileTree";
import { SourceChips } from "@/components/landing/SourceChips";

/** Static sample of repository chat. Not a live AI response. */
export function ChatMockup() {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-black/25">
      <div className="flex items-center justify-between gap-3 border-b border-line px-3 py-2 text-xs">
        <span className="font-mono">{c.repo}</span>
        <span className="text-muted">Sample conversation</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <div className="border-b border-line p-3 sm:border-b-0 sm:border-r">
          <FileTree nodes={FILE_TREE} />
        </div>

        <div className="min-w-0 space-y-3 p-3 text-sm">
          <p className="ml-auto w-fit max-w-[90%] rounded-lg bg-accent/15 px-3 py-2">{c.question}</p>
          <div className="space-y-2 leading-relaxed">
            {c.answer.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
          <SourceChips sources={c.sources} />
        </div>
      </div>
    </div>
  );
}