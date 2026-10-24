/** Limits for what the repository viewer will load. Keep these in one place. */
export const MAX_FILE_BYTES = 200_000; // largest file we will preview
export const MAX_TREE_FILES = 5_000; // most files we list in the explorer

/** Limits for indexing. Free-tier embedding quotas are small, so these are conservative. */
export const MAX_INDEX_FILES = 150; // files per repository
export const MAX_INDEX_FILE_BYTES = 100_000; // largest single file we index
export const MAX_INDEX_CHUNKS = 800; // chunks per repository
export const STALE_JOB_MS = 10 * 60 * 1000; // a job with no progress for this long counts as dead