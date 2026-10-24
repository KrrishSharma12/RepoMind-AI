import Link from "next/link";
import { ArrowLeft, ExternalLink, Globe, Lock } from "lucide-react";
import { IndexPanel } from "@/components/repository/index-panel";
import type { GithubRepository } from "@/lib/github/api";
import type { IndexState } from "@/lib/rag/index-state";

export function RepoHeader({ repo, indexState }: { repo: GithubRepository; indexState: IndexState }) {
  const Visibility = repo.private ? Lock : Globe;

  return (
    <header>
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Dashboard
      </Link>

      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="wrap-break-word text-2xl font-semibold tracking-tight">{repo.full_name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            <span className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-0.5 text-xs text-fg">
              <Visibility className="size-3" aria-hidden="true" />
              {repo.private ? "Private" : "Public"}
            </span>
            {repo.language && <span>{repo.language}</span>}
            <span>Default branch: {repo.default_branch}</span>
          </div>
          {repo.description && <p className="mt-3 max-w-2xl leading-relaxed text-muted">{repo.description}</p>}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start lg:flex-col lg:items-end">
          <IndexPanel owner={repo.owner.login} name={repo.name} initial={indexState} />
          <a
            href={repo.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-line px-4 py-2 text-sm transition-colors hover:bg-panel"
          >
            <ExternalLink className="size-4" aria-hidden="true" />
            Open on GitHub
          </a>
        </div>
      </div>
    </header>
  );
}