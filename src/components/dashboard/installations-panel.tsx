import { Suspense } from "react";
import { headers } from "next/headers";
import { GitPullRequest } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { InstallButton } from "@/components/dashboard/install-button";
import { InstallationSection, type InstallationRow } from "@/components/dashboard/installation-section";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { listUserInstallations } from "@/lib/github/api";
import { getGithubUserToken } from "@/lib/github/user-token";

function RepositoriesSkeleton() {
  return (
    <div aria-hidden="true" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-36 animate-pulse rounded-xl bg-panel" />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <GlassCard className="mt-8 flex flex-col items-start gap-4 p-6 sm:p-8">
      <span className="grid size-10 place-items-center rounded-lg bg-accent/15 text-accent">
        <GitPullRequest className="size-5" aria-hidden="true" />
      </span>
      <div>
        <h2 className="text-lg font-medium">No repositories connected yet</h2>
        <p className="mt-2 max-w-lg leading-relaxed text-muted">
          Install RepoMind AI on GitHub and choose which repositories it may read. You can change this on GitHub at any time.
        </p>
      </div>
      <InstallButton />
    </GlassCard>
  );
}

function PanelError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="mt-8 text-sm text-danger">
      {children}
    </p>
  );
}

/** Reads the database and the session, so render it inside <Suspense>. */
export async function InstallationsPanel() {
  const { user } = await requireSession();

  const saved: InstallationRow[] = await db.installation.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });
  if (saved.length === 0) return <EmptyState />;

  const token = await getGithubUserToken(await headers(), user.id);
  if (!token) {
    return <PanelError>Your GitHub session expired. Sign out and sign in again to see your repositories.</PanelError>;
  }

  // GitHub is the source of truth. If someone uninstalled the app, GitHub no
  // longer lists that installation, so we drop our saved copy of it.
  let liveIds: Set<number>;
  try {
    liveIds = new Set((await listUserInstallations(token)).map((i) => i.id));
  } catch {
    // Could not check, so keep the saved rows and do not delete anything.
    return <PanelError>Could not check your installations with GitHub. Please refresh to try again.</PanelError>;
  }

  const stale = saved.filter((row) => !liveIds.has(row.githubInstallationId));
  if (stale.length > 0) {
    // Safe to repeat: it only removes this user's rows that GitHub no longer has.
    await db.installation.deleteMany({
      where: { userId: user.id, githubInstallationId: { in: stale.map((row) => row.githubInstallationId) } },
    });
  }

  const indexed = await db.repository.findMany({ where: { userId: user.id }, select: { githubRepoId: true, indexingStatus: true } });
  const indexStatuses = Object.fromEntries(indexed.map((r: { githubRepoId: string; indexingStatus: string }) => [r.githubRepoId, r.indexingStatus]));

  const active = saved.filter((row) => liveIds.has(row.githubInstallationId));
  if (active.length === 0) return <EmptyState />;

  return (
    <div className="mt-8 space-y-10">
      {active.map((installation) => (
        <Suspense key={installation.id} fallback={<RepositoriesSkeleton />}>
          <InstallationSection userToken={token} installation={installation} indexStatuses={indexStatuses} />
        </Suspense>
      ))}
      <InstallButton variant="outline">Add or remove repositories</InstallButton>
    </div>
  );
}