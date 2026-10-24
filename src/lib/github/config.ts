import "server-only";

/** Link to GitHub's install page for our app, or null if GITHUB_APP_SLUG is not set. */
export function getInstallUrl(): string | null {
  const slug = process.env.GITHUB_APP_SLUG;
  if (!slug) return null;
  return `https://github.com/apps/${encodeURIComponent(slug)}/installations/new`;
}