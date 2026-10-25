import { describe, expect, it } from "vitest";
import { MAX_CHUNK_CHARS, chunkFile, embeddingText } from "@/lib/rag/chunker";

const numbered = (n: number) => Array.from({ length: n }, (_, i) => `line ${i + 1}`).join("\n");

describe("chunkFile", () => {
  const chunks = chunkFile(numbered(200));

  it("covers every line of the file", () => {
    const covered = new Set<number>();
    for (const c of chunks) for (let l = c.startLine; l <= c.endLine; l++) covered.add(l);
    expect(covered.size).toBe(200);
  });

  it("reports 1-based line ranges that match the text", () => {
    for (const c of chunks) {
      expect(c.content.split("\n")).toHaveLength(c.endLine - c.startLine + 1);
      expect(c.content.startsWith(`line ${c.startLine}`)).toBe(true);
    }
    expect(chunks[0].startLine).toBe(1);
    expect(chunks.at(-1)!.endLine).toBe(200);
  });

  it("overlaps neighbouring chunks and always moves forward", () => {
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i].startLine).toBeLessThanOrEqual(chunks[i - 1].endLine);
      expect(chunks[i].startLine).toBeGreaterThan(chunks[i - 1].startLine);
    }
  });

  it("returns nothing for empty or whitespace-only files", () => {
    expect(chunkFile("")).toEqual([]);
    expect(chunkFile("\n\n   \n")).toEqual([]);
  });

  it("handles Windows line endings", () => {
    const [chunk] = chunkFile("a\r\nb\r\nc");
    expect(chunk.content).toBe("a\nb\nc");
    expect(chunk.endLine).toBe(3);
  });

  it("caps a single huge minified line", () => {
    const result = chunkFile("x".repeat(50_000));
    expect(result).toHaveLength(1);
    expect(result[0].content.length).toBeLessThanOrEqual(MAX_CHUNK_CHARS);
  });

  it("keeps long-line files under the character cap", () => {
    const result = chunkFile(Array.from({ length: 100 }, () => "y".repeat(500)).join("\n"));
    expect(result.length).toBeGreaterThan(1);
    for (const c of result) expect(c.content.length).toBeLessThanOrEqual(MAX_CHUNK_CHARS + 100);
  });

  it("prefers to break on a blank line", () => {
    const text = Array.from({ length: 70 }, (_, i) => (i === 45 ? "" : `code ${i + 1}`)).join("\n");
    expect(chunkFile(text)[0].endLine).toBe(46);
  });
});

describe("embeddingText", () => {
  it("starts with the file path and line range, which helps the model", () => {
    expect(embeddingText("src/a.ts", { content: "x", startLine: 3, endLine: 9 })).toMatch(/^File: src\/a\.ts \(lines 3-9\)\nx$/);
  });
});
