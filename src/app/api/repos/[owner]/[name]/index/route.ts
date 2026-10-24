import { after } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { GithubApiError, getRepository } from "@/lib/github/api";
import { getGithubUserToken } from "@/lib/github/user-token";
import { runIndexingJob } from "@/lib/rag/indexer";
import { STALE_JOB_MS } from "@/lib/repo/limits";
import { isValidRepoPart } from "@/lib/repo/validate";
import { isSameOrigin } from "@/lib/security/origin";

const fail = (error: string, status: number, extra?: Record<string, unknown>) => NextResponse.json({ error, ...extra }, { status });

/** Starts indexing. Returns right away: the work continues in the background. */
export async function POST(request: Request, { params }: { params: Promise<{ owner: string; name: string }> }) {
  if (!isSameOrigin(request)) return fail("Request origin not allowed.", 403);

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return fail("Please sign in.", 401);
  const userId = session.user.id;

  const { owner, name } = await params;
  if (!isValidRepoPart(owner) || !isValidRepoPart(name)) return fail("Invalid repository.", 400);

  if (!process.env.GEMINI_API_KEY) return fail("Indexing is not configured: GEMINI_API_KEY is missing on the server.", 503);

  const token = await getGithubUserToken(request.headers, userId);
  if (!token) return fail("Your GitHub session expired. Sign out and sign in again.", 401);

  // Access check: GitHub only returns repositories this user AND our installation can access.
  let repo;
  try {
    repo = await getRepository(token, owner, name);
  } catch (error) {
    const status = error instanceof GithubApiError ? error.status : 0;
    if (status === 404 || status === 403) return fail("GitHub does not give RepoMind AI access to this repository.", 404);
    return fail("Could not reach GitHub. Please try again.", 502);
  }

  // One job at a time per user protects the free embedding quota. Dead jobs are cleaned up.
  const cutoff = new Date(Date.now() - STALE_JOB_MS);
  const activeStatuses = ["QUEUED", "RUNNING"] as const;
  await db.indexingJob.updateMany({
    where: { repository: { userId }, status: { in: [...activeStatuses] }, updatedAt: { lte: cutoff } },
    data: { status: "FAILED", errorMessage: "The job was interrupted. Please start it again.", completedAt: new Date() },
  });
  const running = await db.indexingJob.findFirst({
    where: { repository: { userId }, status: { in: [...activeStatuses] } },
  });
  if (running) return fail("An indexing job is already running. Wait for it to finish.", 409, { jobId: running.id });

  const repository = await db.repository.upsert({
    where: { userId_githubRepoId: { userId, githubRepoId: String(repo.id) } },
    create: {
      userId,
      githubRepoId: String(repo.id),
      owner: repo.owner.login,
      name: repo.name,
      fullName: repo.full_name,
      defaultBranch: repo.default_branch,
      isPrivate: repo.private,
    },
    update: { owner: repo.owner.login, name: repo.name, fullName: repo.full_name, defaultBranch: repo.default_branch, isPrivate: repo.private },
  });

  const job = await db.indexingJob.create({ data: { repositoryId: repository.id, status: "QUEUED", phase: "Queued" } });

  // Continue after the response is sent. See the note in lib/rag/indexer.ts about production use.
  after(() =>
    runIndexingJob({
      jobId: job.id,
      repositoryId: repository.id,
      userToken: token,
      owner: repo.owner.login,
      name: repo.name,
      branch: repo.default_branch,
    }),
  );

  return NextResponse.json({ jobId: job.id }, { status: 202 });
}