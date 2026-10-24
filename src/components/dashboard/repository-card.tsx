import Link from "next/link";
import { ExternalLink, Globe, Lock, Star } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import type { GithubRepository } from "@/lib/github/api";

const dateFormat = new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });

const STATUS_LABEL: Record<string, string> = {
  INDEXED: "Indexed",
  INDEXING: "Indexing...",
  FAILED: "Index failed",
};

export function RepositoryCard({ repo, indexStatus }: { repo: GithubRepository; indexStatus?: string }) {
  const Visibility = repo.private ? Lock : Globe;
  const workspaceHref = `/dashboard/repos/${encodeURIComponent(repo.owner.login)}/${encodeURIComponent(repo.name)}`;

  return (
    <GlassCard className="flex min-w-0 flex-col gap-3 p-4 transition-colors hover:border-white/25">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 wrap-break-word font-medium">{repo.name}</h3>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-white/10 px-2 py-0.5 text-xs">
          <Visibility className="size-3" aria-hidden="true" />
          {repo.private ? "Private" : "Public"}
        </span>
      </div>

      <p className="line-clamp-2 min-h-10 text-sm leading-relaxed text-muted">
        {repo.description ?? "No description provided."}
      </p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        {repo.language && <span>{repo.language}</span>}
        <span className="inline-flex items-center gap-1">
          <Star className="size-3" aria-hidden="true" />
          {repo.stargazers_count}
        </span>
        <span>Branch: {repo.default_branch}</span>
        <span>Updated {dateFormat.format(new Date(repo.updated_at))}</span>
        <span>{STATUS_LABEL[indexStatus ?? ""] ?? "Not indexed"}</span>
      </div>

      <div className="mt-auto flex flex-wrap gap-2 pt-1">
        <Link
          href={workspaceHref}
          className="inline-flex items-center rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-fg transition-colors hover:brightness-110"
        >
          Open workspace
        </Link>
        {indexStatus === "INDEXED" && (
          <Link
            href={`${workspaceHref}?tab=chat`}
            className="inline-flex items-center rounded-lg border border-line px-3 py-2 text-sm transition-colors hover:bg-panel"
          >
            Ask about code
          </Link>
        )}
        <a
          href={repo.html_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm transition-colors hover:bg-panel"
        >
          <ExternalLink className="size-3.5" aria-hidden="true" />
          Open on GitHub
          <span className="sr-only"> (new tab)</span>
        </a>
      </div>
    </GlassCard>
  );
}