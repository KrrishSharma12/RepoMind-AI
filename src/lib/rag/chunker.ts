/**
 * Splits a source file into overlapping pieces of roughly TARGET_LINES lines.
 * Every piece remembers its line range, so answers can cite file:line.
 * Pure function with no imports, so it is easy to test.
 */

export interface Chunk {
  content: string;
  startLine: number; // 1-based, inclusive
  endLine: number; // 1-based, inclusive
}

export const TARGET_LINES = 60;
export const OVERLAP_LINES = 10;
export const MAX_CHUNK_CHARS = 3000;

export function chunkFile(text: string): Chunk[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const chunks: Chunk[] = [];
  let start = 0;

  while (start < lines.length) {
    // Take up to TARGET_LINES lines, but stop early if the piece gets too many characters.
    let end = start;
    let chars = 0;
    while (end < lines.length && end - start < TARGET_LINES) {
      const next = Math.min(lines[end].length, MAX_CHUNK_CHARS) + 1;
      if (end > start && chars + next > MAX_CHUNK_CHARS) break;
      chars += next;
      end++;
    }

    // Prefer to end on a blank line so a function is less likely to be cut in half.
    if (end < lines.length) {
      for (let i = end; i > start + Math.floor(TARGET_LINES / 2); i--) {
        if (lines[i - 1].trim() === "") {
          end = i;
          break;
        }
      }
    }

    const content = lines
      .slice(start, end)
      .map((line) => line.slice(0, MAX_CHUNK_CHARS))
      .join("\n")
      .trimEnd();

    if (content.trim() !== "") {
      chunks.push({ content, startLine: start + 1, endLine: end });
    }

    if (end >= lines.length) break;
    start = Math.max(end - OVERLAP_LINES, start + 1);
  }

  return chunks;
}

/** The text we send to the embedding model: the path gives the model useful context. */
export function embeddingText(path: string, chunk: Chunk): string {
  return `File: ${path} (lines ${chunk.startLine}-${chunk.endLine})\n${chunk.content}`;
}