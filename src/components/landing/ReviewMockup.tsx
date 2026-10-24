import { REVIEW_MOCK as r } from "@/lib/constants/landing";
import { SeverityBadge } from "@/components/landing/SeverityBadge";

/** Static sample of a pull request review. Not a live AI response. */
export function ReviewMockup() {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-black/25 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2 text-xs">
        <span className="font-medium">
          #{r.number} {r.title}
        </span>
        <span className="break-all font-mono text-muted">{r.file}</span>
      </div>

      <pre className="overflow-x-auto py-2 font-mono text-xs leading-6" aria-label="Changed code">
        {r.diff.map((l) => (
          <div key={l.n} className={l.n === r.primary.line ? "bg-accent/15" : undefined}>
            <span className="inline-block w-8 select-none pr-2 text-right text-muted/70">{l.n}</span>
            <span className="text-ok">+ </span>
            {l.text}
          </div>
        ))}
      </pre>

      <div className="space-y-3 border-t border-line p-3">
        <div className="rounded-lg border border-line p-3">
          <SeverityBadge severity={r.primary.severity} />
          <p className="mt-2 leading-relaxed">{r.primary.text}</p>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Repository context: <span className="break-words font-mono text-fg">{r.primary.context}</span>
          </p>
          <p className="mb-1 mt-3 text-xs text-muted">Suggested fix</p>
          <pre className="overflow-x-auto rounded-md bg-black/30 p-2 font-mono text-xs leading-5">
            {r.primary.fix.join("\n")}
          </pre>
        </div>

        <ul className="space-y-2">
          {r.others.map((f) => (
            <li key={f.severity} className="flex flex-col gap-1.5 rounded-lg border border-line p-3 sm:flex-row sm:items-start sm:gap-3">
              <span className="shrink-0"><SeverityBadge severity={f.severity} /></span>
              <p className="leading-relaxed text-muted">
                <span className="font-mono text-xs text-fg">line {f.line}</span> {f.text}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}