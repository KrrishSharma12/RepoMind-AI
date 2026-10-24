const REPO_PART = /^[A-Za-z0-9._-]{1,100}$/;

/** Owner or repository name taken from the URL. */
export function isValidRepoPart(value: string): boolean {
  return REPO_PART.test(value) && value !== "." && value !== "..";
}

/** A file path taken from the URL. Rejects traversal and odd characters. */
export function isSafePath(path: string): boolean {
  if (!path || path.length > 1000) return false;
  if (path.startsWith("/") || path.includes("\\") || path.includes("\0")) return false;
  return !path.split("/").some((segment) => segment === "" || segment === "." || segment === "..");
}

/** Encode each path segment but keep the slashes. */
export function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}