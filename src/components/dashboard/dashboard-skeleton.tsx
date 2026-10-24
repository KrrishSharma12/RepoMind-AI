/** Shown for a moment while the session is checked. */
export function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard">
      <div className="border-b border-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <div className="h-6 w-32 animate-pulse rounded bg-panel" />
          <div className="h-8 w-24 animate-pulse rounded bg-panel" />
        </div>
      </div>
      <div className="mx-auto max-w-6xl space-y-4 px-5 py-10">
        <div className="h-8 w-64 animate-pulse rounded bg-panel" />
        <div className="h-40 animate-pulse rounded-xl bg-panel" />
      </div>
    </div>
  );
}