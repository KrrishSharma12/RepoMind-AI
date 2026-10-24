import type { SourceRef } from "@/lib/chat/types";

interface ChunkRef {
  path: string;
  startLine: number;
  endLine: number;
}

/**
 * Lists the code pieces the model was given, and marks the ones its answer
 * refers to. A source counts as cited if the answer contains "[path:" or the
 * path itself. Nothing is added that was not in the retrieved set, so a made-up
 * file name can never show up as a source.
 */
export function findCitedSources(answer: string, chunks: ChunkRef[]): SourceRef[] {
  const seen = new Set<string>();
  const result: SourceRef[] = [];

  for (const chunk of chunks) {
    const key = `${chunk.path}:${chunk.startLine}-${chunk.endLine}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      path: chunk.path,
      startLine: chunk.startLine,
      endLine: chunk.endLine,
      cited: answer.includes(`[${chunk.path}:`) || answer.includes(chunk.path),
    });
  }
  return result;
}