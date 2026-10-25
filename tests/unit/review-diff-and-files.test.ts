import { describe, expect, it } from "vitest";
import { selectReviewFiles } from "@/lib/review/files";
import { annotatePatch, parsePatch } from "@/lib/review/patch";

const patch = [
  "@@ -10,6 +10,9 @@ export function a() {",
  " const x = 1;",
  " const y = 2;",
  "-const z = 3;",
  "+const z = 4;",
  "+const w = 5;",
  "+const v = 6;",
  " return x;",
  " }",
  "@@ -40,3 +43,4 @@",
  " foo();",
  "+bar();",
  " baz();",
  "\\ No newline at end of file",
].join("\n");

const sorted = (set: Set<number>) => [...set].sort((a, b) => a - b);

describe("parsePatch", () => {
  it("finds the exact new-side line numbers in the diff", () => {
    const { rightLines, addedLines } = parsePatch(patch);
    expect(sorted(rightLines)).toEqual([10, 11, 12, 13, 14, 15, 16, 43, 44, 45]);
    expect(sorted(addedLines)).toEqual([12, 13, 14, 44]);
  });

  it("ignores text outside a hunk and handles blank context lines", () => {
    expect(parsePatch("").rightLines.size).toBe(0);
    expect(parsePatch("+stray\n-line").rightLines.size).toBe(0);
    expect(sorted(parsePatch("@@ -1,2 +1,2 @@\n a\n\n+b\n").rightLines)).toEqual([1, 2, 3]);
  });
});

describe("annotatePatch", () => {
  const annotated = annotatePatch(patch);

  it("labels new-side lines and gives removed lines no number", () => {
    expect(annotated).toContain("L12 +const z = 4;");
    expect(annotated).toContain("L44 +bar();");
    expect(annotated).toContain("L10  const x = 1;");
    expect(annotated).toContain("     -const z = 3;");
    expect(annotated).not.toMatch(/L\d+ -/);
    expect(annotated).not.toContain("No newline");
  });
});

const patchOf = (n: number) => `@@ -1,2 +1,${n} @@\n a\n${Array.from({ length: n - 1 }, (_, i) => `+line${i + 2}`).join("\n")}`;
const file = (filename: string, extra: Record<string, unknown> = {}) => ({
  filename, status: "modified", additions: 5, deletions: 1, changes: 6, patch: patchOf(5), ...extra,
});

describe("selectReviewFiles", () => {
  it("sends only reviewable files, biggest changes first", () => {
    const result = selectReviewFiles([
      file("src/a.ts", { changes: 10 }),
      file("src/big.ts", { changes: 90 }),
      file("pnpm-lock.yaml"),
      file("dist/app.js"),
      file("node_modules/x/index.js"),
      file(".env"),
      file("config/id_rsa"),
      file("cert.pem"),
      file("logo.png", { patch: undefined }),
      file("old.ts", { status: "removed" }),
      file("src/min.min.js"),
      file("src/secret.ts", { patch: "@@ -1 +1 @@\n+const k = 'AKIAIOSFODNN7EXAMPLE';" }),
      file(".env.example", { changes: 1 }),
    ]);
    expect(result.selected.map((f) => f.path)).toEqual(["src/big.ts", "src/a.ts", ".env.example"]);
    expect(result.skipped).toBe(10);
    expect(result.selected[0].annotated).toContain("L2 +line2");
    expect(result.selected[0].addedLines.has(2)).toBe(true);
    expect(result.selected[0].addedLines.has(1)).toBe(false);
  });

  it("caps the number of files and the amount of diff text", () => {
    expect(selectReviewFiles(Array.from({ length: 40 }, (_, i) => file(`src/f${i}.ts`))).selected).toHaveLength(15);

    const huge = file("src/huge.ts", {
      changes: 2000,
      patch: `@@ -1 +1,2000 @@\n${Array.from({ length: 2000 }, (_, i) => `+const variable${i} = ${i};`).join("\n")}`,
    });
    const result = selectReviewFiles([huge, file("src/b.ts"), file("src/c.ts"), file("src/d.ts")]);
    expect(result.selected[0].annotated.endsWith("[diff shortened]")).toBe(true);
    expect(result.selected[0].annotated.length).toBeLessThanOrEqual(12_020);
    expect(result.selected.reduce((n, f) => n + f.annotated.length, 0)).toBeLessThanOrEqual(40_020);
    expect(selectReviewFiles([]).selected).toEqual([]);
  });
});
