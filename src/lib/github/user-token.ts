import "server-only";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";

/**
 * The signed-in user's GitHub token, decrypted by Better Auth (and refreshed if
 * it can be). Returns null if there is none, for example after it expired.
 * The token stays on the server. Never send it to the browser or log it.
 */
export async function getGithubUserToken(headers: Headers, userId: string): Promise<string | null> {
  try {
    // Better Auth looks tokens up by the id of the stored account row.
    const account = await db.account.findFirst({
      where: { userId, providerId: "github" },
      select: { id: true },
    });
    if (!account) return null;

    const result = await auth.api.getAccessToken({ body: { accountId: account.id }, headers });
    return result?.accessToken ?? null;
  } catch {
    return null;
  }
}