import { ExternalLink } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { db } from "@/lib/db";
import { findUserRepository } from "@/lib/rag/conversations";
import { parseStoredFindings } from "@/lib/review/findings";
import { cn } from "@/lib/utils";

const dateFormat = new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

const STATUS_STYLE: Record<string, string> = {
  COMPLETED: "bg-ok/15 text-ok",
  FAILED: "bg-danger/15 text-danger",
  SKIPPED: "bg-white/10 text-muted",
  RUNNING: "bg-accent/15 text-accent",
  QUEUED: "bg-accent/15 text-accent",
};
const STATUS_LABEL: Record<string, string> = {
  COMPLETED: "Reviewed",
  FAILED: "Failed",
  SKIPPED: "Skipped",
  RUNNING: "Reviewing...",
  QUEUED: "Queued",
};

interface ReviewRow {
  id: string;
  prNumber: number;
  prTitle: string;
  prUrl: string;
  status: string;
  skipReason: string | null;
  errorMessage: string | null;
  findingsCount: number;
  commentsPosted: number;
  findings: unknown;
  usedContext: boolean;
  createdAt: Date;
}

function EmptyState() {
  return (
    <GlassCard className="p-6">
      <h2 className="text-lg font-medium">No pull request reviews yet</h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
        When someone opens or updates a pull request on this repository, RepoMind AI reviews it and lists the result here. To
        try it: make sure the GitHub App has the Pull requests permission and webhook set up, keep the webhook forwarder
        running, then open a pull request that changes some code.
      </p>
    </GlassCard>
  );
}

/** The signed-in user's own reviews for one repository. */
export async function ReviewsSection({ userId, owner, name }: { userId: string; owner: string; name: string }) {
  const repository = await findUserRepository(userId, owner, name);
  if (!repository) return <EmptyState />;

  const reviews: ReviewRow[] = await db.pullRequestReview.findMany({
    where: { repositoryId: repository.id },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  if (reviews.length === 0) return <EmptyState />;

  return (
    <ul className="space-y-3">
      {reviews.map((review) => {
        const findings = parseStoredFindings(review.findings);
        const safeUrl = review.prUrl.startsWith("https://github.com/") ? review.prUrl : null;
        const note = review.errorMessage ?? review.skipReason;

        return (
          <li key={review.id}>
            <GlassCard className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="wrap-break-word font-medium">
                    #{review.prNumber} {review.prTitle}
                  </p>
                  <p className="mt-1 text-xs text-muted">{dateFormat.format(review.createdAt)} UTC</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn("rounded-md px-2 py-0.5 text-xs", STATUS_STYLE[review.status])}>{STATUS_LABEL[review.status] ?? review.status}</span>
                  {safeUrl && (
                    <a
                      href={safeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-muted transition-colors hover:text-fg"
                    >
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                      Open pull request
                    </a>
                  )}
                </div>
              </div>

              {note && <p className={cn("mt-3 text-sm", review.errorMessage ? "text-danger" : "text-muted")}>{note}</p>}

              {review.status === "COMPLETED" && (
                <p className="mt-3 text-sm text-muted">
                  {review.findingsCount === 0 ? "No clear issues found." : `${review.findingsCount} potential ${review.findingsCount === 1 ? "issue" : "issues"} found.`}
                  {review.usedContext ? " Used related code from the repository." : " Diff only (the repository was not indexed)."}
                </p>
              )}

              {findings.length > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm">Show findings</summary>
                  <ul className="mt-3 space-y-3">
                    {findings.map((f) => (
                      <li key={`${f.path}:${f.line}`} className="rounded-lg border border-line p-3 text-sm">
                        <p className="font-mono text-xs text-muted">
                          {f.path}:{f.line}
                        </p>
                        <p className="mt-1 font-medium">
                          {f.severity}: {f.title}
                        </p>
                        <p className="mt-1 leading-relaxed text-muted">{f.explanation}</p>
                        {f.suggestion && (
                          <pre className="mt-2 overflow-x-auto rounded-md bg-black/30 p-2 font-mono text-xs">{f.suggestion}</pre>
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </GlassCard>
          </li>
        );
      })}
    </ul>
  );
}