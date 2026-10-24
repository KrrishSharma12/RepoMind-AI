import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";

/** Current session or null. Cached so it runs once per request. */
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

/** For protected pages: returns the session, or sends visitors to the landing page. */
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/");
  return session;
}