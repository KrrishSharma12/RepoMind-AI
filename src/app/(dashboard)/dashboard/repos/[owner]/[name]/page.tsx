import { Suspense } from "react";
import { RepoWorkspace } from "@/components/repository/repo-workspace";
import { WorkspaceSkeleton } from "@/components/repository/workspace-skeleton";

export const metadata = { title: "Repository | RepoMind AI" };

// The page stays static. The params and search params are passed down as
// promises and read inside the Suspense boundary.
export default function RepositoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ owner: string; name: string }>;
  searchParams: Promise<{ path?: string | string[]; tab?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <RepoWorkspace params={params} searchParams={searchParams} />
    </Suspense>
  );
}