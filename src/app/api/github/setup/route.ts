import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { listUserInstallations } from "@/lib/github/api";
import { getGithubUserToken } from "@/lib/github/user-token";

/**
 * GitHub sends people here after they install the app (the "Setup URL").
 * We never trust the installation_id in the URL on its own: we ask GitHub,
 * with the user's own token, whether that installation belongs to them.
 */
export async function GET(request: Request) {
  const base = process.env.BETTER_AUTH_URL ?? new URL(request.url).origin;
  const back = (result: string) => NextResponse.redirect(new URL(`/dashboard?install=${result}`, base));

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.redirect(new URL("/", base));

  const params = new URL(request.url).searchParams;

  // An organization member asked an owner to approve the install. Nothing to save yet.
  if (params.get("setup_action") === "request") return back("pending");

  const raw = params.get("installation_id");
  const installationId = Number(raw);
  if (!raw || !Number.isSafeInteger(installationId) || installationId <= 0) return back("invalid");

  const token = await getGithubUserToken(request.headers, session.user.id);
  if (!token) return back("reauth");

  try {
    const installations = await listUserInstallations(token);
    const match = installations.find((i) => i.id === installationId);
    if (!match) return back("denied");

    const data = {
      accountLogin: match.account?.login ?? match.account?.slug ?? "unknown",
      accountType: match.account?.type ?? "Unknown",
      accountAvatarUrl: match.account?.avatar_url ?? null,
      repositorySelection: match.repository_selection,
    };

    await db.installation.upsert({
      where: { userId_githubInstallationId: { userId: session.user.id, githubInstallationId: installationId } },
      create: { userId: session.user.id, githubInstallationId: installationId, ...data },
      update: data,
    });

    return back("ok");
  } catch {
    return back("failed");
  }
}