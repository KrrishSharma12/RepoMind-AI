/** Turns a question into search words for keyword search. Pure functions, easy to test. */

const STOP_WORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "all", "can", "had", "her", "was", "one", "our", "out",
  "how", "what", "where", "when", "why", "who", "which", "does", "did", "has", "have", "this", "that", "these",
  "those", "with", "from", "into", "about", "there", "their", "them", "then", "than", "being", "been", "will",
  "would", "could", "should", "explain", "tell", "show", "find", "please", "project", "repo", "repository",
  "code", "file", "files", "work", "works", "used", "use", "using", "implemented", "implementation", "any",
]);

/** Lowercase search words, including the pieces of camelCase names like validateJwt. */
export function extractKeywords(question: string, max = 10): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  const add = (word: string) => {
    const w = word.toLowerCase();
    if (w.length >= 3 && !STOP_WORDS.has(w) && !seen.has(w)) {
      seen.add(w);
      found.push(w);
    }
  };

  for (const token of question.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []) {
    add(token);
    for (const part of token.split(/(?<=[a-z0-9])(?=[A-Z])|_/)) add(part);
  }
  return found.slice(0, max);
}

/** Builds a Postgres to_tsquery string. Words are already limited to letters, digits, and underscores. */
export function toTsQuery(words: string[]): string | null {
  const safe = words.filter((w) => /^[a-z0-9_]+$/.test(w));
  return safe.length > 0 ? safe.join(" | ") : null;
}