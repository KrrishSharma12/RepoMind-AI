import "server-only";
import { GithubApiError } from "@/lib/github/api";

const API_URL = "https://api.github.com";
const MAX_FILE_PAGES = 3; // up to 300 changed files

export interface PullRequestFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

export interface ReviewComment {
  path: string;
  line: number;
  side: "RIGHT";
  body: string;
}

async function githubRequest(path: string, token: string, init?: { method: string; body: unknown }): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      Authorization: `Bearer ${token}`,
      ...(init ? { "Content-Type": "application/json" } : {}),
    },
    body: init ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
}

/** The changed files of a pull request, with their diffs. */
export async function listPullRequestFiles(
  token: string,
  owner: string,
  repo: string,
  number: number,
): Promise<{ files: PullRequestFile[]; truncated: boolean }> {
  const files: PullRequestFile[] = [];
  let truncated = false;

  for (let page = 1; page <= MAX_FILE_PAGES; page++) {
    const response = await githubRequest(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${number}/files?per_page=100&page=${page}`,
      token,
    );
    if (!response.ok) throw new GithubApiError(response.status, `GitHub API returned ${response.status}.`);

    const batch = (await response.json()) as PullRequestFile[];
    files.push(...batch);
    if (batch.length < 100) return { files, truncated };
    if (page === MAX_FILE_PAGES) truncated = true;
  }
  return { files, truncated };
}

const MAX_REVIEW_BODY = 60_000; // GitHub allows 65,536 characters

/**
 * Posts one review made of inline comments. It is always a plain "comment" review:
 * the bot never approves or blocks a pull request. If GitHub rejects the inline
 * comments (for example a line moved), the findings are posted in the review text instead.
 */
export async function createPullRequestReview(
  token: string,
  owner: string,
  repo: string,
  number: number,
  review: { commitId: string; body: string; comments: ReviewComment[] },
): Promise<{ inline: boolean }> {
  const path = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${number}/reviews`;

  const attempt = await githubRequest(path, token, {
    method: "POST",
    body: { commit_id: review.commitId, body: review.body, event: "COMMENT", comments: review.comments },
  });
  if (attempt.ok) return { inline: true };

  if (attempt.status !== 422 || review.comments.length === 0) {
    throw new GithubApiError(attempt.status, `GitHub API returned ${attempt.status}.`);
  }

  // Fall back: put the findings in the review text, with no inline comments.
  const inlineAsText = review.comments.map((c) => `**${c.path}:${c.line}**\n\n${c.body}`).join("\n\n---\n\n");
  const fallback = await githubRequest(path, token, {
    method: "POST",
    body: { commit_id: review.commitId, body: `${review.body}\n\n${inlineAsText}`.slice(0, MAX_REVIEW_BODY), event: "COMMENT" },
  });
  if (!fallback.ok) throw new GithubApiError(fallback.status, `GitHub API returned ${fallback.status}.`);
  return { inline: false };
}