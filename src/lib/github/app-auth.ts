import "server-only";
import { createSign } from "node:crypto";

/**
 * How the bot signs in. The app proves who it is with a short-lived JWT signed by
 * its private key, then trades that for an installation token that only works on
 * the repository being reviewed. Neither the key nor any token is ever logged.
 */

export class GithubAppError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "GithubAppError";
    this.status = status;
  }
}

const base64url = (input: Buffer | string) => Buffer.from(input).toString("base64url");

/** .env files hold the key on one line with literal \n. Turn those back into line breaks. */
export function normalizePrivateKey(raw: string): string {
  return raw.replace(/\\n/g, "\n").trim();
}

/** A 9-minute JWT (GitHub's maximum is 10) signed with the app's private key. */
export function createAppJwt(appId: string, privateKey: string, nowSeconds = Math.floor(Date.now() / 1000)): string {
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iat: nowSeconds - 60, // allows for small clock differences
      exp: nowSeconds + 9 * 60,
      iss: /^\d+$/.test(appId) ? Number(appId) : appId,
    }),
  );
  const signature = createSign("RSA-SHA256").update(`${header}.${payload}`).sign(normalizePrivateKey(privateKey));
  return `${header}.${payload}.${base64url(signature)}`;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}
const cache = new Map<string, CachedToken>();
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

/**
 * A token for one installation, limited to the named repositories and to the two
 * permissions the reviewer needs. Cached until shortly before it expires.
 */
export async function getInstallationToken(installationId: number, repositoryNames: string[]): Promise<string> {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;
  if (!appId || !privateKey) throw new GithubAppError("GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY is not set on the server.", 500);

  const key = `${installationId}:${[...repositoryNames].sort().join(",")}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt - Date.now() > REFRESH_MARGIN_MS) return cached.token;

  let jwt: string;
  try {
    jwt = createAppJwt(appId, privateKey);
  } catch {
    throw new GithubAppError("GITHUB_APP_PRIVATE_KEY could not be read. Check that it is the full key with \\n for line breaks.", 500);
  }

  const response = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      repositories: repositoryNames,
      permissions: { contents: "read", pull_requests: "write" },
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    // Status only. The response body is never included.
    throw new GithubAppError(
      response.status === 401
        ? "GitHub rejected the app credentials. Check GITHUB_APP_ID and the private key."
        : response.status === 404
          ? "GitHub could not find this installation. The app may have been uninstalled."
          : response.status === 422
            ? "GitHub refused the requested permissions. Check the app's Contents and Pull requests permissions."
            : `GitHub returned status ${response.status} when creating an installation token.`,
      response.status,
    );
  }

  const data = (await response.json()) as { token?: string; expires_at?: string };
  if (!data.token || !data.expires_at) throw new GithubAppError("GitHub returned an unexpected token response.", 502);

  cache.set(key, { token: data.token, expiresAt: Date.parse(data.expires_at) });
  return data.token;
}