const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const escapeMarkdownText = (value: string) => value.replace(/([[\]\\])/g, "\\$1");
const escapeUrl = (value: string) => value.replace(/\(/g, "%28").replace(/\)/g, "%29");

/**
 * Turns citations like [src/auth.ts:10-42] into links, but only for files that were
 * really retrieved for this answer. A made-up path stays plain text.
 */
export function linkifyCitations(text: string, paths: string[], hrefFor: (path: string) => string): string {
  let result = text;
  const unique = [...new Set(paths)].sort((a, b) => b.length - a.length);

  for (const path of unique) {
    const pattern = new RegExp(`\\[${escapeRegExp(path)}:(\\d+)(?:-(\\d+))?\\]`, "g");
    result = result.replace(pattern, (_match, start: string, end?: string) => {
      const label = `${path}:${start}${end ? `-${end}` : ""}`;
      return `[${escapeMarkdownText(label)}](${escapeUrl(hrefFor(path))})`;
    });
  }
  return result;
}