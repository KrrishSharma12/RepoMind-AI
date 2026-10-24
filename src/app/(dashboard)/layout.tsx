import { Suspense } from "react";
import { AuthedShell } from "@/components/dashboard/authed-shell";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  // The layout itself stays static. Everything that reads the session
  // lives inside the Suspense boundary, which Cache Components requires.
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <AuthedShell>{children}</AuthedShell>
    </Suspense>
  );
}