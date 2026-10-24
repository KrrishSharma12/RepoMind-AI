import { requireSession } from "@/lib/auth/session";

/** Reads the session, so render it inside its own <Suspense> boundary. */
export async function WelcomeHeading() {
  const { user } = await requireSession();

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Welcome, {user.name}</h1>
      <p className="mt-2 text-muted">You are signed in with GitHub.</p>
    </>
  );
}