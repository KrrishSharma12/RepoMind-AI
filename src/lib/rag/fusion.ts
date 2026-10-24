/**
 * Reciprocal Rank Fusion: combines several ranked lists (for example meaning-based
 * and keyword-based search) into one. An item near the top of any list scores well,
 * and an item near the top of several lists scores best.
 */
export function fuseRankings(rankings: string[][], k = 60): string[] {
  const scores = new Map<string, number>();
  for (const ranking of rankings) {
    ranking.forEach((id, index) => {
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + index + 1));
    });
  }
  return [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}