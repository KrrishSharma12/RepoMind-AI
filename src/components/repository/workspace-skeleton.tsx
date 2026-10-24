export function WorkspaceSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading repository" className="space-y-6">
      <div className="h-8 w-72 animate-pulse rounded bg-panel" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="h-64 animate-pulse rounded-xl bg-panel" />
        <div className="h-96 animate-pulse rounded-xl bg-panel" />
      </div>
    </div>
  );
}