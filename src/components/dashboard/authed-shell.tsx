import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { requireSession } from "@/lib/auth/session";

/**
 * Reads the session cookie, which is runtime data, so it must render inside a
 * <Suspense> boundary (see the dashboard layout). Visitors without a session
 * are sent back to the landing page.
 */
export async function AuthedShell({ children }: { children: React.ReactNode }) {
  const { user } = await requireSession();

  return (
    <>
      <DashboardHeader name={user.name} image={user.image} />
      <main className="mx-auto max-w-6xl px-5 py-10">{children}</main>
    </>
  );
}