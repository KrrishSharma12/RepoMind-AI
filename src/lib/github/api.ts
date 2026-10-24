import "server-only";
import { encodePath } from "@/lib/repo/validate";
import { MAX_FILE_BYTES } from "@/lib/repo/limits";

const API_URL = "https://api.github.com";

export class GithubApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "GithubApiError";
  }
}

export interface GithubInstallation {
  id: number;
  // Organizations and users have `login`. Enterprise accounts have `slug`.
  account: { login?: string; slug?: string; type?: string; avatar_url?: string } | null;
  repository_selection: "all" | "selected";
}

export interface GithubRepository {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  private: boolean;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  default_branch: string;
  html_url: string;
  updated_at: string;
}

async function githubGet<T>(path: string, userToken: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      Authorization: `Bearer ${userToken}`,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const rateLimited = res.status === 403 && res.headers.get("x-ratelimit-remaining") === "0";
    // Never include the token or the response body in the message.
    throw new GithubApiError(res.status, rateLimited ? "GitHub rate limit reached." : `GitHub API returned ${res.status}.`);
  }
  return (await res.json()) as T;
}

/** Installations of our app that this user can access. Used to prove ownership. */
export async function listUserInstallations(userToken: string): Promise<GithubInstallation[]> {
  const data = await githubGet<{ installations: GithubInstallation[] }>("/user/installations?per_page=100", userToken);
  return data.installations;
}

/** Repositories that both this user and the installation can access. First 100 only for now. */
export async function listInstallationRepositories(userToken: string, installationId: number) {
  const data = await githubGet<{ total_count: number; repositories: GithubRepository[] }>(
    `/user/installations/${installationId}/repositories?per_page=100`,
    userToken,
  );
  return { total: data.total_count, repositories: data.repositories };
}

/** One repository the user can access through our installation. Throws GithubApiError(404) if not. */
export async function getRepository(userToken: string, owner: string, name: string): Promise<GithubRepository> {
  return githubGet<GithubRepository>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`, userToken);
}

/** Every file on a commit or branch. GitHub says `truncated` when the repository is too big to list fully. */
export async function getRepositoryTree(userToken: string, owner: string, name: string, ref: string) {
  const data = await githubGet<{ tree: { path: string; type: string; sha: string; size?: number }[]; truncated: boolean }>(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
    userToken,
  );
  const blobs = data.tree.filter((entry) => entry.type === "blob");
  return {
    files: blobs.map((entry) => entry.path),
    entries: blobs.map((entry) => ({ path: entry.path, sha: entry.sha, size: entry.size ?? 0 })),
    truncated: data.truncated,
  };
}

/** The commit a branch points to right now. */
export async function getBranchCommitSha(userToken: string, owner: string, name: string, branch: string): Promise<string> {
  const data = await githubGet<{ object: { sha: string } }>(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/git/ref/heads/${encodePath(branch)}`,
    userToken,
  );
  return data.object.sha;
}

/** A file's text by its git blob SHA, or null if it is binary. */
export async function getBlobText(userToken: string, owner: string, name: string, sha: string): Promise<string | null> {
  const data = await githubGet<{ content: string; encoding: string }>(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/git/blobs/${encodeURIComponent(sha)}`,
    userToken,
  );
  if (data.encoding !== "base64") return null;
  const buffer = Buffer.from(data.content, "base64");
  if (buffer.subarray(0, 8000).includes(0)) return null;
  return buffer.toString("utf8");
}

export type FileContent =
  | { kind: "text"; text: string; size: number }
  | { kind: "binary"; size: number }
  | { kind: "too-large"; size: number }
  | { kind: "unsupported" };

/** One file's contents, fetched only when someone opens it. */
export async function getFileContent(
  userToken: string,
  owner: string,
  name: string,
  path: string,
  ref: string,
): Promise<FileContent> {
  const data = await githubGet<{ type?: string; size?: number; content?: string; encoding?: string }>(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`,
    userToken,
  );

  // A directory comes back as an array and symlinks or submodules have other types.
  if (Array.isArray(data) || data.type !== "file" || data.encoding !== "base64") return { kind: "unsupported" };

  const size = data.size ?? 0;
  if (size > MAX_FILE_BYTES || !data.content) return { kind: "too-large", size };

  const buffer = Buffer.from(data.content, "base64");
  // A zero byte near the start is the usual sign of a binary file.
  if (buffer.subarray(0, 8000).includes(0)) return { kind: "binary", size };

  return { kind: "text", text: buffer.toString("utf8"), size };
}