import { describe, expect, it } from "vitest";
import { GithubApiError } from "@/lib/github/api";
import { createPullRequestReview, listPullRequestFiles } from "@/lib/github/pull-request";
import { bodyOf, jsonResponse, mockFetch } from "../helpers";

const sha = "a".repeat(40);
const patchFile = (name: string) => ({ filename: name, status: "modified", additions: 1, deletions: 0, changes: 1, patch: "@@ -1 +1 @@\n+a" });

describe("listPullRequestFiles", () => {
  it("reads every page of changed files", async () => {
    const fetchMock = mockFetch((url) => {
      const page = Number(new URL(url).searchParams.get("page"));
      return jsonResponse(Array.from({ length: page === 1 ? 100 : 30 }, (_, i) => patchFile(`f${page}-${i}.ts`)));
    });
    const { files, truncated } = await listPullRequestFiles("tok", "alice", "my-repo", 7);
    expect(files).toHaveLength(130);
    expect(truncated).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/repos/alice/my-repo/pulls/7/files?per_page=100&page=1");
  });

  it("stops after 300 files and says so", async () => {
    mockFetch(() => jsonResponse(Array.from({ length: 100 }, () => patchFile("x.ts"))));
    expect((await listPullRequestFiles("tok", "a", "b", 1)).truncated).toBe(true);
  });

  it("fails with a safe error", async () => {
    mockFetch(() => jsonResponse({ message: "Bad credentials TOKENLEAK" }, 401));
    const error = await listPullRequestFiles("tok", "a", "b", 1).catch((e: Error) => e);
    expect(error).toBeInstanceOf(GithubApiError);
    expect((error as GithubApiError).status).toBe(401);
    expect((error as GithubApiError).message).not.toContain("LEAK");
  });
});

describe("createPullRequestReview", () => {
  const comments = [{ path: "a.ts", line: 3, side: "RIGHT" as const, body: "**Security: x**\n\nexplain" }];

  it("posts a plain COMMENT review and never approves or blocks", async () => {
    const fetchMock = mockFetch(() => jsonResponse({ id: 1 }));
    await expect(createPullRequestReview("TOK", "alice", "my-repo", 7, { commitId: sha, body: "summary", comments })).resolves.toEqual({ inline: true });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe("https://api.github.com/repos/alice/my-repo/pulls/7/reviews");
    expect(init.headers.Authorization).toBe("Bearer TOK");
    expect(bodyOf(init)).toMatchObject({ event: "COMMENT", commit_id: sha, comments });
  });

  it("falls back to text in the review body when GitHub rejects the inline lines", async () => {
    let calls = 0;
    const fetchMock = mockFetch(() => (calls++ === 0 ? jsonResponse({ message: "line must be part of the diff" }, 422) : jsonResponse({ id: 2 })));
    await expect(createPullRequestReview("T", "a", "b", 1, { commitId: sha, body: "summary", comments })).resolves.toEqual({ inline: false });

    const second = bodyOf(fetchMock.mock.calls[1][1] as RequestInit);
    expect(second.comments).toBeUndefined();
    expect(second.event).toBe("COMMENT");
    expect(second.body).toContain("summary");
    expect(second.body).toContain("a.ts:3");
    expect(second.body).toContain("explain");
  });

  it("does not retry when there were no inline comments, or on other errors", async () => {
    mockFetch(() => jsonResponse({}, 422));
    await expect(createPullRequestReview("T", "a", "b", 1, { commitId: sha, body: "s", comments: [] })).rejects.toBeInstanceOf(GithubApiError);
    mockFetch(() => jsonResponse({}, 500));
    await expect(createPullRequestReview("T", "a", "b", 1, { commitId: sha, body: "s", comments })).rejects.toMatchObject({ status: 500 });
  });
});
