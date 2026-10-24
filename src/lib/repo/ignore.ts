/** Directories we never list or read: dependencies, build output, and git internals. */
const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  "vendor",
  ".next",
]);

export function isIgnoredPath(path: string): boolean {
  return path.split("/").some((segment) => IGNORED_DIRS.has(segment));
}