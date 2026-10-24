import "server-only";
import { db } from "@/lib/db";
import { STALE_JOB_MS } from "@/lib/repo/limits";

export type RepoIndexStatus = "NOT_INDEXED" | "INDEXING" | "INDEXED" | "FAILED";

export interface IndexState {
  status: RepoIndexStatus;
  lastIndexedAt: string | null;
  fileCount: number;
  chunkCount: number;
  job: {
    status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
    phase: string | null;
    totalFiles: number;
    processedFiles: number;
    totalChunks: number;
    skippedFiles: number;
    errorMessage: string | null;
  } | null;
}

export const EMPTY_INDEX_STATE: IndexState = { status: "NOT_INDEXED", lastIndexedAt: null, fileCount: 0, chunkCount: 0, job: null };

/** Reads the index status for one of THIS user's repositories. Other users' data is never matched. */
export async function getIndexState(userId: string, owner: string, name: string): Promise<IndexState> {
  const repository = await db.repository.findFirst({
    where: {
      userId,
      owner: { equals: owner, mode: "insensitive" },
      name: { equals: name, mode: "insensitive" },
    },
  });
  if (!repository) return EMPTY_INDEX_STATE;

  const [job, fileCount, chunkCount] = await Promise.all([
    db.indexingJob.findFirst({ where: { repositoryId: repository.id }, orderBy: { createdAt: "desc" } }),
    db.repositoryFile.count({ where: { repositoryId: repository.id } }),
    db.codeChunk.count({ where: { repositoryId: repository.id } }),
  ]);

  let jobView: IndexState["job"] = null;
  let status: RepoIndexStatus = repository.indexingStatus;

  if (job) {
    const active = job.status === "QUEUED" || job.status === "RUNNING";
    const stale = active && Date.now() - job.updatedAt.getTime() > STALE_JOB_MS;
    jobView = {
      status: stale ? "FAILED" : job.status,
      phase: job.phase,
      totalFiles: job.totalFiles,
      processedFiles: job.processedFiles,
      totalChunks: job.totalChunks,
      skippedFiles: job.skippedFiles,
      errorMessage: stale ? "The job was interrupted. Please start it again." : job.errorMessage,
    };
    if (stale) status = "FAILED";
  }

  return { status, lastIndexedAt: repository.lastIndexedAt?.toISOString() ?? null, fileCount, chunkCount, job: jobView };
}