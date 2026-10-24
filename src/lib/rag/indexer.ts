import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { EmbeddingError, embedDocuments } from "@/lib/ai/embeddings";
import { GithubApiError, getBlobText, getBranchCommitSha, getRepositoryTree } from "@/lib/github/api";
import { isIgnoredPath } from "@/lib/repo/ignore";
import { containsSecret, shouldIndexPath } from "@/lib/repo/indexable";
import { languageForPath } from "@/lib/repo/language";
import { MAX_INDEX_CHUNKS, MAX_INDEX_FILES } from "@/lib/repo/limits";
import { chunkFile, embeddingText } from "@/lib/rag/chunker";

export interface IndexingContext {
  jobId: string;
  repositoryId: string;
  userToken: string;
  owner: string;
  name: string;
  branch: string;
}

class IndexingFailure extends Error {}

interface ExistingFile {
  id: string;
  path: string;
  contentHash: string;
  _count: { chunks: number };
}

const toVectorLiteral = (vector: number[]) => `[${vector.join(",")}]`;

/** Only messages we wrote ourselves, or ones that carry just a status code, reach the user. */
function userMessage(error: unknown): string {
  if (error instanceof IndexingFailure || error instanceof EmbeddingError) return error.message;
  if (error instanceof GithubApiError) {
    return error.status === 401
      ? "Your GitHub session expired. Sign out, sign in again, and retry."
      : `GitHub returned an error (status ${error.status}). Please retry.`;
  }
  return "Indexing failed unexpectedly. Please try again.";
}

/**
 * Indexes one repository. Safe to run again: unchanged files (same git blob SHA)
 * are skipped, and each file is replaced in one transaction, so a retry never
 * creates duplicate chunks. Never throws: failures are recorded on the job.
 *
 * DEVELOPMENT FALLBACK: this runs inside the web server process. A long job can
 * be lost if the server restarts. The plan is to move it to a separate worker
 * with a persistent queue.
 */
export async function runIndexingJob(ctx: IndexingContext): Promise<void> {
  try {
    await execute(ctx);
  } catch (error) {
    // Log the kind of error only. Never log tokens or file contents.
    console.error("Indexing job failed", { jobId: ctx.jobId, error: error instanceof Error ? error.name : "unknown" });
    await db.$transaction([
      db.indexingJob.update({ where: { id: ctx.jobId }, data: { status: "FAILED", errorMessage: userMessage(error), completedAt: new Date() } }),
      db.repository.update({ where: { id: ctx.repositoryId }, data: { indexingStatus: "FAILED" } }),
    ]).catch(() => undefined);
  }
}

async function execute(ctx: IndexingContext): Promise<void> {
  const { jobId, repositoryId, userToken, owner, name, branch } = ctx;
  const setJob = (data: Prisma.IndexingJobUpdateInput) => db.indexingJob.update({ where: { id: jobId }, data });

  await setJob({ status: "RUNNING", phase: "Listing files", startedAt: new Date() });
  await db.repository.update({ where: { id: repositoryId }, data: { indexingStatus: "INDEXING" } });

  const commitSha = await getBranchCommitSha(userToken, owner, name, branch);
  const tree = await getRepositoryTree(userToken, owner, name, commitSha);

  const candidates = tree.entries
    .filter((entry) => !isIgnoredPath(entry.path) && shouldIndexPath(entry.path, entry.size))
    .sort((a, b) => a.path.split("/").length - b.path.split("/").length || a.path.localeCompare(b.path));

  const entries = candidates.slice(0, MAX_INDEX_FILES);
  let skipped = candidates.length - entries.length;

  await setJob({ phase: "Embedding", totalFiles: entries.length, skippedFiles: skipped, commitSha });

  // Forget files that no longer exist (their chunks are deleted with them).
  const existing: ExistingFile[] = await db.repositoryFile.findMany({
    where: { repositoryId },
    select: { id: true, path: true, contentHash: true, _count: { select: { chunks: true } } },
  });
  const keep = new Set(entries.map((entry) => entry.path));
  const removed = existing.filter((file) => !keep.has(file.path)).map((file) => file.id);
  if (removed.length > 0) await db.repositoryFile.deleteMany({ where: { id: { in: removed } } });
  const previous = new Map(existing.map((file) => [file.path, file]));

  let processed = 0;
  let chunkTotal = 0;

  for (const entry of entries) {
    const before = previous.get(entry.path);

    if (before && before.contentHash === entry.sha) {
      // Unchanged since the last run, so keep its embeddings.
      chunkTotal += before._count.chunks;
    } else {
      const text = await getBlobText(userToken, owner, name, entry.sha);

      if (text === null || containsSecret(text)) {
        if (before) await db.repositoryFile.delete({ where: { id: before.id } });
        skipped++;
      } else {
        const chunks = chunkFile(text);
        if (chunkTotal + chunks.length > MAX_INDEX_CHUNKS) {
          skipped += entries.length - processed;
          break;
        }

        const vectors = chunks.length > 0 ? await embedDocuments(chunks.map((chunk) => embeddingText(entry.path, chunk))) : [];

        await db.$transaction(
          async (tx: Prisma.TransactionClient) => {
            const file = await tx.repositoryFile.upsert({
              where: { repositoryId_path: { repositoryId, path: entry.path } },
              create: { repositoryId, path: entry.path, language: languageForPath(entry.path), contentHash: entry.sha, size: entry.size },
              update: { language: languageForPath(entry.path), contentHash: entry.sha, size: entry.size },
            });
            await tx.codeChunk.deleteMany({ where: { repositoryFileId: file.id } });
            if (chunks.length > 0) {
              const rows = chunks.map(
                (chunk, i) =>
                  Prisma.sql`(${randomUUID()}, ${repositoryId}, ${file.id}, ${i}, ${chunk.content}, ${chunk.startLine}, ${chunk.endLine}, ${toVectorLiteral(vectors[i])}::vector)`,
              );
              await tx.$executeRaw`INSERT INTO "code_chunk" ("id", "repositoryId", "repositoryFileId", "chunkIndex", "content", "startLine", "endLine", "embedding") VALUES ${Prisma.join(rows)}`;
            }
          },
          { timeout: 30_000, maxWait: 10_000 },
        );
        chunkTotal += chunks.length;
      }
    }

    processed++;
    await setJob({ processedFiles: processed, totalChunks: chunkTotal, skippedFiles: skipped });
  }

  // Only now is the repository marked as indexed.
  await db.$transaction([
    db.indexingJob.update({
      where: { id: jobId },
      data: { status: "SUCCEEDED", phase: "Done", processedFiles: processed, totalChunks: chunkTotal, skippedFiles: skipped, completedAt: new Date() },
    }),
    db.repository.update({
      where: { id: repositoryId },
      data: { indexingStatus: "INDEXED", lastIndexedCommitSha: commitSha, lastIndexedAt: new Date() },
    }),
  ]);
}