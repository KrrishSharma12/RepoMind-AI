import { Suspense } from "react";
import { InstallNotice } from "@/components/dashboard/install-notice";
import { InstallationsPanel } from "@/components/dashboard/installations-panel";
import { WelcomeHeading } from "@/components/dashboard/welcome-heading";

export const metadata = { title: "Dashboard | RepoMind AI" };

// The page itself is static. Anything that reads the session, the database,
// or the URL lives in its own component inside <Suspense>.
export default function DashboardPage() {
  return (
    <section>
      <Suspense
        fallback={
          <div aria-hidden="true">
            <div className="h-9 w-64 animate-pulse rounded bg-panel" />
            <div className="mt-3 h-5 w-48 animate-pulse rounded bg-panel" />
          </div>
        }
      >
        <WelcomeHeading />
      </Suspense>

      <Suspense fallback={null}>
        <InstallNotice />
      </Suspense>

      <Suspense fallback={<div aria-hidden="true" className="mt-8 h-40 animate-pulse rounded-xl bg-panel" />}>
        <InstallationsPanel />
      </Suspense>
    </section>
  );
}