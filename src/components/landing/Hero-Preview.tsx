import { CHAT_MOCK as c, FILE_TREE, REVIEW_MOCK as r } from "@/lib/constants/landing";
import { GlassCard } from "@/components/ui/glass-card";
import { FileTree } from "@/components/landing/FileTree";
import { SeverityBadge } from "@/components/landing/SeverityBadge";
import { SourceChips } from "@/components/landing/SourceChips";

/** Compact static preview showing both products: repository chat and PR review. */
export function HeroPreview() {
  return (
    <GlassCard className="w-full min-w-0 overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 text-xs">
        <span className="font-mono">{c.repo}</span>
        <span className="text-muted">Sample data</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[9rem_minmax(0,1fr)]">
        <aside className="hidden border-r border-line p-3 sm:block">
          <FileTree nodes={FILE_TREE} />
        </aside>

        <div className="min-w-0 space-y-4 p-4 text-sm">
          <section aria-label="Repository chat sample" className="space-y-3">
            <p className="ml-auto w-fit max-w-[90%] rounded-lg bg-accent/15 px-3 py-2">{c.question}</p>
            <p className="leading-relaxed">{c.answer[0]}</p>
            <SourceChips sources={c.sources} />
          </section>

          <section aria-label="Pull request review sample" className="space-y-2 border-t border-line pt-4">
            <p className="text-xs text-muted">
              Pull request #{r.number}: {r.title}
            </p>
            <div className="rounded-lg border border-line p-3">
              <SeverityBadge severity={r.primary.severity} />
              <p className="mt-2 leading-relaxed">{r.primary.text}</p>
            </div>
          </section>
        </div>
      </div>
    </GlassCard>
  );
}