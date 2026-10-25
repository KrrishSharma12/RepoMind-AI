import { describe, expect, it } from "vitest";
import { findCitedSources } from "@/lib/rag/citations";
import { fuseRankings } from "@/lib/rag/fusion";
import { extractKeywords, toTsQuery } from "@/lib/rag/keywords";

describe("extractKeywords", () => {
  it("keeps meaningful words and drops filler", () => {
    const words = extractKeywords("Where is JWT validation implemented?");
    expect(words).toEqual(expect.arrayContaining(["jwt", "validation"]));
    expect(words).not.toContain("where");
    expect(words).not.toContain("implemented");
  });

  it("splits camelCase names into their parts", () => {
    const words = extractKeywords("what does validateUserToken do");
    expect(words).toEqual(expect.arrayContaining(["validateusertoken", "validate", "token"]));
  });
});

describe("toTsQuery", () => {
  it("joins safe words with OR", () => {
    expect(toTsQuery(["jwt", "auth_user"])).toBe("jwt | auth_user");
  });

  it("never lets unsafe characters reach the database query", () => {
    expect(toTsQuery(["bad'word", "x;drop"])).toBeNull();
    expect(toTsQuery([])).toBeNull();
  });
});

describe("fuseRankings", () => {
  it("ranks items found by both searches above items found by one", () => {
    const fused = fuseRankings([["a", "b", "c"], ["c", "b", "d"]]);
    expect(new Set(fused.slice(0, 2))).toEqual(new Set(["b", "c"]));
    expect(new Set(fused.slice(2))).toEqual(new Set(["a", "d"]));
  });

  it("copes with empty lists", () => {
    expect(fuseRankings([[], []])).toEqual([]);
    expect(fuseRankings([["x", "y"], []])).toEqual(["x", "y"]);
  });
});

describe("findCitedSources", () => {
  const chunks = [
    { path: "src/auth.ts", startLine: 1, endLine: 40 },
    { path: "src/auth.ts", startLine: 1, endLine: 40 },
    { path: "src/db.ts", startLine: 5, endLine: 30 },
    { path: "src/app/[owner]/page.tsx", startLine: 1, endLine: 9 },
  ];

  it("marks cited files, removes duplicates, and handles brackets in paths", () => {
    const sources = findCitedSources("Login is in [src/auth.ts:10-20] and [src/app/[owner]/page.tsx:1-3].", chunks);
    expect(sources).toHaveLength(3);
    expect(sources.find((s) => s.path === "src/auth.ts")!.cited).toBe(true);
    expect(sources.find((s) => s.path === "src/db.ts")!.cited).toBe(false);
    expect(sources.find((s) => s.path === "src/app/[owner]/page.tsx")!.cited).toBe(true);
  });

  it("never turns an invented file name into a source", () => {
    const sources = findCitedSources("See also src/ghost.ts", chunks);
    expect(sources.some((s) => s.path === "src/ghost.ts")).toBe(false);
  });
});
