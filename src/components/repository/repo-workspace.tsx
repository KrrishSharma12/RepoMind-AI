import { Suspense } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ChatSection } from "@/components/chat/chat-section";
import { ReviewsSection } from "@/components/review/reviews-section";
import { GlassCard } from "@/components/ui/glass-card";
import { FileExplorer } from "@/components/repository/file-explorer";
import { FileViewer } from "@/components/repository/file-viewer";
import { RepoHeader } from "@/components/repository/repo-header";
import { WorkspaceTabs } from "@/components/repository/workspace-tabs";
import { requireSession } from "@/lib/auth/session";
import { GithubApiError, getRepository, getRepositoryTree } from "@/lib/github/api";
import { getGithubUserToken } from "@/lib/github/user-token";
import { getIndexState } from "@/lib/rag/index-state";
import { isIgnoredPath } from "@/lib/repo/ignore";
import { MAX_TREE_FILES } from "@/lib/repo/limits";
import { isSafePath, isValidRepoPart } from "@/lib/repo/validate";

interface RepoWorkspaceProps {
  params: Promise<{ owner: string; name: string }>;
  searchParams: Promise<{ path?: string | string[]; tab?: string | string[] }>;
}

function Message({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "error" }) {
  return (
    <p role={tone === "error" ? "alert" : undefined} className={tone === "error" ? "text-sm text-danger" : "text-sm text-muted"}>
      {children}
    </p>
  );
}

/**
 * Loads the repository, its file list, and the selected file.
 * Access is enforced by GitHub itself: we use the signed-in user's own token,
 * which only sees repositories that the user AND our app installation can access.
 */
export async function RepoWorkspace({ params, searchParams }: RepoWorkspaceProps) {
  const [{ owner, name }, query] = await Promise.all([params, searchParams]);
  if (!isValidRepoPart(owner) || !isValidRepoPart(name)) notFound();

  const { user } = await requireSession();
  const token = await getGithubUserToken(await headers(), user.id);
  if (!token) return <Message tone="error">Your GitHub session expired. Sign out and sign in again.</Message>;

  let repo;
  try {
    repo = await getRepository(token, owner, name);
  } catch (error) {
    const status = error instanceof GithubApiError ? error.status : null;
    // Log the status only, never the token, so the terminal shows what GitHub said.
    console.error("Could not load repository", { owner, name, status });

    if (status === 404) {
      return (
        <Message tone="error">
          GitHub cannot find {owner}/{name} for your account (status 404). Check that RepoMind AI is installed on this
          repository and that you can access it, then go back to the dashboard.
        </Message>
      );
    }
    if (status === 403) {
      return (
        <Message tone="error">
          GitHub refused access (status 403). The GitHub App may be missing the read permission for Contents or
          Metadata, or GitHub&apos;s rate limit was reached. Check the app&apos;s permissions on GitHub and approve any
          pending changes.
        </Message>
      );
    }
    if (status === 401) {
      return <Message tone="error">Your GitHub session expired (status 401). Sign out and sign in again.</Message>;
    }
    return <Message tone="error">Could not load this repository from GitHub. Please refresh to try again.</Message>;
  }

  const activeTab = query.tab === "chat" ? "chat" : query.tab === "reviews" ? "reviews" : "code";

  let files: string[] = [];
  let truncated = false;
  let empty = false;
  if (activeTab === "code") {
    try {
      const tree = await getRepositoryTree(token, repo.owner.login, repo.name, repo.default_branch);
      files = tree.files.filter((path) => !isIgnoredPath(path));
      truncated = tree.truncated;
    } catch (error) {
      if (error instanceof GithubApiError && error.status === 409) empty = true;
      else return <Message tone="error">Could not load the file list from GitHub. Please refresh to try again.</Message>;
    }
  }

  const listTooLong = files.length > MAX_TREE_FILES;
  if (listTooLong) files = files.slice(0, MAX_TREE_FILES);

  // Only files that appear in the listing can be opened. This also blocks made-up paths.
  const requested = typeof query.path === "string" ? query.path : null;
  const fileSet = new Set(files);
  const readme = files.find((f) => /^readme(\.[a-z]+)?$/i.test(f)) ?? null;
  const selected = requested ?? readme;
  const selectedValid = selected !== null && isSafePath(selected) && fileSet.has(selected);

  const indexState = await getIndexState(user.id, repo.owner.login, repo.name);

  const baseHref = `/dashboard/repos/${encodeURIComponent(repo.owner.login)}/${encodeURIComponent(repo.name)}`;

  return (
    <div className="space-y-8">
      <RepoHeader repo={repo} indexState={indexState} />

      <WorkspaceTabs baseHref={baseHref} active={activeTab} />

      {activeTab === "chat" ? (
        <Suspense fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-xl bg-panel" />}>
          <ChatSection
            userId={user.id}
            owner={repo.owner.login}
            name={repo.name}
            baseHref={baseHref}
            indexed={indexState.chunkCount > 0}
          />
        </Suspense>
      ) : activeTab === "reviews" ? (
        <ReviewsSection userId={user.id} owner={repo.owner.login} name={repo.name} />
      ) : empty ? (
        <Message>This repository is empty. Push some code to GitHub and refresh.</Message>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="min-w-0">
            <FileExplorer files={files} selectedPath={selectedValid ? selected : null} baseHref={baseHref} branch={repo.default_branch} />
            {(truncated || listTooLong) && (
              <p className="mt-3 text-xs text-muted">
                This repository is large, so only part of the file list is shown.
              </p>
            )}
          </aside>

          <section className="min-w-0" aria-label="File preview">
            {selectedValid ? (
              <Suspense key={selected} fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-xl bg-panel" />}>
                <FileViewer userToken={token} owner={repo.owner.login} name={repo.name} branch={repo.default_branch} path={selected} />
              </Suspense>
            ) : (
              <GlassCard className="p-6">
                <Message>
                  {requested ? "That file was not found in this repository." : "Select a file from the list to read its code."}
                </Message>
              </GlassCard>
            )}
          </section>
        </div>
      )}
    </div>
  );
}