import "server-only";
import { db } from "@/lib/db";
import { EmbeddingError } from "@/lib/ai/embeddings";
import { ChatModelError } from "@/lib/ai/gemini-chat";
import { generateJson } from "@/lib/ai/gemini-json";
import { GithubApiError } from "@/lib/github/api";
import { GithubAppError, getInstallationToken } from "@/lib/github/app-auth";
import { createPullRequestReview, listPullRequestFiles, type ReviewComment } from "@/lib/github/pull-request";
import type { PullRequestEvent } from "@/lib/github/webhook";
import { retrieveChunks } from "@/lib/rag/retrieve";
import { selectReviewFiles } from "@/lib/review/files";
import { buildSummary, formatCommentBody, validateFindings } from "@/lib/review/findings";
import { REVIEW_RESPONSE_SCHEMA, buildReviewPrompt } from "@/lib/review/prompt";

const MAX_REVIEWS_PER_REPO_PER_HOUR = 10;
const MAX_RELATED_CHUNKS = 6;
const REVIEW_TIMEOUT_MS = 120_000;

/** Only messages we wrote, or ones that carry just a status code, ever reach the dashboard. */
function userMessage(error: unknown): string {
  if (error instanceof GithubAppError || error instanceof ChatModelError || error instanceof EmbeddingError) return error.message;
  if (error instanceof GithubApiError) return `GitHub returned an error (status ${error.status}).`;
  return "The review failed unexpectedly.";
}

const isUniqueViolation = (error: unknown) => (error as { code?: string } | null)?.code === "P2002";

/** Finds the user and repository record this pull request belongs to. */
async function resolveRepository(event: PullRequestEvent): Promise<{ id: string; indexed: boolean } | null> {
  const installs: { userId: string }[] = await db.installation.findMany({
    where: { githubInstallationId: event.installationId },
    select: { userId: true },
    orderBy: { createdAt: "asc" },
  });
  if (installs.length === 0) return null; // nobody linked this installation to an account

  const userIds = installs.map((i) => i.userId);
  const existing: { id: string; _count: { chunks: number } }[] = await db.repository.findMany({
    where: { userId: { in: userIds }, githubRepoId: String(event.githubRepoId) },
    select: { id: true, _count: { select: { chunks: true } } },
    orderBy: { lastIndexedAt: { sort: "desc", nulls: "last" } },
  });

  const indexed = existing.find((r) => r._count.chunks > 0);
  if (indexed) return { id: indexed.id, indexed: true };
  if (existing[0]) return { id: existing[0].id, indexed: false };

  const created = await db.repository.upsert({
    where: { userId_githubRepoId: { userId: userIds[0], githubRepoId: String(event.githubRepoId) } },
    create: {
      userId: userIds[0],
      githubRepoId: String(event.githubRepoId),
      owner: event.owner,
      name: event.repo,
      fullName: event.fullName,
      defaultBranch: event.defaultBranch,
      isPrivate: event.isPrivate,
    },
    update: {},
    select: { id: true },
  });
  return { id: created.id, indexed: false };
}

/** Records this review, or returns null if this exact commit was already handled. */
async function claimReview(repositoryId: string, event: PullRequestEvent): Promise<string | null> {
  try {
    const created = await db.pullRequestReview.create({
      data: { repositoryId, prNumber: event.number, prTitle: event.title, prUrl: event.url, headSha: event.headSha, status: "QUEUED" },
      select: { id: true },
    });
    return created.id;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const existing = await db.pullRequestReview.findUnique({
      where: { repositoryId_prNumber_headSha: { repositoryId, prNumber: event.number, headSha: event.headSha } },
      select: { id: true, status: true },
    });
    if (existing?.status === "FAILED") {
      await db.pullRequestReview.update({ where: { id: existing.id }, data: { status: "QUEUED", errorMessage: null } });
      return existing.id;
    }
    return null; // a repeated delivery for a commit we already reviewed
  }
}

/**
 * Reviews one pull request. Never throws: any failure is recorded on the review.
 *
 * DEVELOPMENT FALLBACK: this runs inside the web server process, started by the
 * webhook route. A long review can be lost if the server restarts. The plan is to
 * move it to the separate worker with a persistent queue.
 */
export async function runPullRequestReview(event: PullRequestEvent): Promise<void> {
  let reviewId: string | null = null;
  const update = (data: Record<string, unknown>) => db.pullRequestReview.update({ where: { id: reviewId! }, data });

  try {
    const repository = await resolveRepository(event);
    if (!repository) {
      console.warn("Webhook for an installation that is not linked to any account", { installationId: event.installationId });
      return;
    }

    reviewId = await claimReview(repository.id, event);
    if (!reviewId) return;

    // Protect the shared Gemini quota: a busy repository cannot trigger unlimited reviews.
    const recent = await db.pullRequestReview.count({
      where: { repositoryId: repository.id, createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } },
    });
    if (recent > MAX_REVIEWS_PER_REPO_PER_HOUR) {
      await update({ status: "SKIPPED", skipReason: "Too many reviews for this repository in the last hour.", completedAt: new Date() });
      return;
    }

    await update({ status: "RUNNING", startedAt: new Date() });
    const signal = AbortSignal.timeout(REVIEW_TIMEOUT_MS);

    // A token that works only on this repository, with only the permissions a review needs.
    const token = await getInstallationToken(event.installationId, [event.repo]);

    const { files, truncated } = await listPullRequestFiles(token, event.owner, event.repo, event.number);
    const { selected, skipped } = selectReviewFiles(files);
    if (selected.length === 0) {
      await update({ status: "SKIPPED", skipReason: "No reviewable changes (only lockfiles, generated, binary, or sensitive files).", completedAt: new Date() });
      return;
    }

    // Related code from elsewhere in the repository, using the same index that powers chat.
    let related: { path: string; startLine: number; endLine: number; content: string }[] = [];
    if (repository.indexed) {
      try {
        const changed = new Set(selected.map((f) => f.path));
        const added = selected.map((f) => f.annotated).join("\n").replace(/^L\d+ \+/gm, "").slice(0, 1200);
        const found = await retrieveChunks({
          repositoryId: repository.id,
          question: `${event.title}\n${selected.map((f) => f.path).join(" ")}\n${added}`,
        });
        // The index holds the old version of changed files, so keep only other files.
        related = found.filter((chunk) => !changed.has(chunk.path)).slice(0, MAX_RELATED_CHUNKS);
      } catch (error) {
        console.warn("Review continued without related code", { error: error instanceof Error ? error.name : "unknown" });
      }
    }

    const prompt = buildReviewPrompt({ title: event.title, body: event.body, files: selected, related });
    const raw = await generateJson({
      systemInstruction: prompt.systemInstruction,
      contents: prompt.contents,
      responseSchema: REVIEW_RESPONSE_SCHEMA,
      signal,
    });

    const findings = validateFindings(raw, new Map(selected.map((f) => [f.path, f])));
    const usedContext = prompt.usedRelated > 0;

    // Stay quiet on later pushes when nothing was found, so the bot does not add noise.
    if (findings.length === 0 && event.action !== "opened") {
      await update({ status: "COMPLETED", findingsCount: 0, findings: [], usedContext, completedAt: new Date() });
      return;
    }

    const comments: ReviewComment[] = findings.map((f) => ({ path: f.path, line: f.line, side: "RIGHT", body: formatCommentBody(f) }));
    const summary = buildSummary({
      findings,
      reviewedFiles: selected.length,
      skippedFiles: skipped + (truncated ? 1 : 0),
      usedContext,
    });
    const { inline } = await createPullRequestReview(token, event.owner, event.repo, event.number, {
      commitId: event.headSha,
      body: summary,
      comments,
    });

    await update({
      status: "COMPLETED",
      findingsCount: findings.length,
      commentsPosted: inline ? comments.length : 0,
      findings,
      usedContext,
      completedAt: new Date(),
    });
  } catch (error) {
    // Log the kind of error only. Never log tokens, keys, diffs, or code.
    console.error("Pull request review failed", { pr: event.number, error: error instanceof Error ? error.name : "unknown" });
    if (reviewId) {
      await update({ status: "FAILED", errorMessage: userMessage(error), completedAt: new Date() }).catch(() => undefined);
    }
  }
}