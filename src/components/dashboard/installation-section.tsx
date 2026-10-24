import { GithubApiError, listInstallationRepositories, type GithubRepository } from "@/lib/github/api";
import { RepositoryCard } from "@/components/dashboard/repository-card";

export interface InstallationRow {
  id: string;
  githubInstallationId: number;
  accountLogin: string;
  accountType: string;
  repositorySelection: string;
}

interface InstallationSectionProps {
  userToken: string;
  installation: InstallationRow;
  indexStatuses: Record<string, string>;
}

/** One connected GitHub account and the repositories shared from it. */
export async function InstallationSection({ userToken, installation, indexStatuses }: InstallationSectionProps) {
  let result: { total: number; repositories: GithubRepository[] } | null = null;
  let failure: string | null = null;

  try {
    result = await listInstallationRepositories(userToken, installation.githubInstallationId);
  } catch (error) {
    failure =
      error instanceof GithubApiError && error.status === 401
        ? "Your GitHub session expired. Sign out and sign in again."
        : error instanceof GithubApiError && error.status === 404
          ? "GitHub no longer has this installation. It may have been removed."
          : "Could not load repositories from GitHub. Please refresh to try again.";
  }

  let content: React.ReactNode;
  if (failure !== null || result === null) {
    content = (
      <p role="alert" className="text-sm text-danger">
        {failure}
      </p>
    );
  } else if (result.repositories.length === 0) {
    content = <p className="text-sm text-muted">No repositories are shared from this account yet.</p>;
  } else {
    const { total, repositories } = result;
    content = (
      <>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {repositories.map((repo) => (
            <li key={repo.id} className="min-w-0">
              <RepositoryCard repo={repo} indexStatus={indexStatuses[String(repo.id)]} />
            </li>
          ))}
        </ul>
        {total > repositories.length && (
          <p className="mt-3 text-sm text-muted">Showing the first {repositories.length} of {total} repositories.</p>
        )}
      </>
    );
  }

  return (
    <section aria-label={`Repositories from ${installation.accountLogin}`}>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-lg font-medium">{installation.accountLogin}</h2>
        <span className="text-sm text-muted">
          {installation.accountType}, {installation.repositorySelection === "all" ? "all repositories" : "selected repositories"}
        </span>
      </div>
      {content}
    </section>
  );
}
