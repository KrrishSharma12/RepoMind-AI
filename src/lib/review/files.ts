import { isIgnoredPath } from "@/lib/repo/ignore";
import { containsSecret, isSensitivePath } from "@/lib/repo/indexable";
import { annotatePatch, parsePatch } from "@/lib/review/patch";
import type { PullRequestFile } from "@/lib/github/pull-request";

export const MAX_REVIEW_FILES = 15;
export const MAX_TOTAL_DIFF_CHARS = 40_000;
export const MAX_FILE_DIFF_CHARS = 12_000;

export interface ReviewFile {
  path: string;
  status: string;
  /** The diff with "L<number>" labels on new-side lines. This is what the model reads. */
  annotated: string;
  rightLines: Set<number>;
  addedLines: Set<number>;
}

export interface FileSelection {
  selected: ReviewFile[];
  skipped: number;
}

const LOCKFILES = new Set([
  "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "composer.lock", "cargo.lock", "poetry.lock", "go.sum", "bun.lockb", "gemfile.lock",
]);

function isNoisyPath(path: string): boolean {
  const name = (path.split("/").pop() ?? "").toLowerCase();
  return LOCKFILES.has(name) || name.endsWith(".min.js") || name.endsWith(".min.css") || name.endsWith(".map") || name.endsWith(".snap");
}

/**
 * Chooses which changed files to send for review. Secrets and noise never leave the
 * server: sensitive files, lockfiles, build output, and any diff that contains
 * something that looks like a real key or token are skipped.
 */
export function selectReviewFiles(
  files: PullRequestFile[],
  limits: { maxFiles?: number; maxTotalChars?: number; maxFileChars?: number } = {},
): FileSelection {
  const maxFiles = limits.maxFiles ?? MAX_REVIEW_FILES;
  const maxTotal = limits.maxTotalChars ?? MAX_TOTAL_DIFF_CHARS;
  const maxFile = limits.maxFileChars ?? MAX_FILE_DIFF_CHARS;

  const candidates = files.filter((file) => {
    if (file.status === "removed" || !file.patch) return false; // deleted, binary, or too large for GitHub to show
    if (isSensitivePath(file.filename) || isIgnoredPath(file.filename) || isNoisyPath(file.filename)) return false;
    if (containsSecret(file.patch)) return false;
    return true;
  });

  // Bigger changes first: they are the most likely to hide a problem.
  candidates.sort((a, b) => b.changes - a.changes);

  const selected: ReviewFile[] = [];
  let total = 0;
  for (const file of candidates) {
    if (selected.length >= maxFiles || total >= maxTotal) break;

    const { rightLines, addedLines } = parsePatch(file.patch!);
    let annotated = annotatePatch(file.patch!);
    if (annotated.length > maxFile) annotated = `${annotated.slice(0, maxFile)}\n[diff shortened]`;
    if (total + annotated.length > maxTotal && selected.length > 0) break;

    total += annotated.length;
    selected.push({ path: file.filename, status: file.status, annotated, rightLines, addedLines });
  }

  return { selected, skipped: files.length - selected.length };
}