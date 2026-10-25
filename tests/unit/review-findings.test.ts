import { describe, expect, it } from "vitest";
import { buildSummary, formatCommentBody, parseStoredFindings, sanitizeText, validateFindings } from "@/lib/review/findings";
import { parsePatch } from "@/lib/review/patch";

// api.ts: new lines 10 (context), 11, 12 (added), 13 (context), 14 (added). other.ts: lines 1 (context), 2 (added).
const files = new Map([
  ["src/api.ts", parsePatch("@@ -10,3 +10,5 @@\n a\n+b\n+c\n d\n+e")],
  ["src/other.ts", parsePatch("@@ -1,1 +1,2 @@\n x\n+y")],
]);

const finding = (over: Record<string, unknown> = {}) => ({
  path: "src/api.ts", line: 11, severity: "Security", title: "Missing auth check", explanation: "Anyone can call this.",
  suggestion: "if (!user) return;", confidence: "high", ...over,
});

describe("validateFindings", () => {
  it("accepts a valid finding, as a list or inside { findings }", () => {
    expect(validateFindings({ findings: [finding()] }, files)).toHaveLength(1);
    expect(validateFindings([finding()], files)).toHaveLength(1);
  });

  it("turns junk output into an empty list", () => {
    for (const junk of [null, "nope", { findings: "x" }, 42]) expect(validateFindings(junk, files)).toEqual([]);
  });

  it("drops invented files, lines outside the diff, bad severities, and low confidence", () => {
    const bad = [
      finding({ path: "src/ghost.ts" }), finding({ line: 99 }), finding({ line: 1.5 }), finding({ line: "11" }),
      finding({ severity: "Critical" }), finding({ confidence: "low" }), finding({ confidence: "certain" }),
      finding({ title: "" }), finding({ explanation: "   " }), 42, null, "x",
    ];
    expect(validateFindings(bad, files)).toEqual([]);
  });

  it("keeps one finding per line, most serious first, and caps the total", () => {
    const result = validateFindings(
      [
        finding({ line: 11 }),
        finding({ line: 11, title: "Duplicate" }),
        finding({ line: 12, severity: "Maintainability", title: "m" }),
        finding({ line: 13, severity: "Performance", confidence: "medium", title: "p" }),
        finding({ line: 2, path: "src/other.ts", severity: "Potential Bug", title: "b" }),
      ],
      files,
    );
    expect(result.map((f) => f.severity)).toEqual(["Security", "Potential Bug", "Performance", "Maintainability"]);

    const many = Array.from({ length: 30 }, (_, i) => finding({ line: 10 + (i % 5), path: i % 2 ? "src/api.ts" : "src/other.ts" }));
    expect(validateFindings(many, files, 3).length).toBeLessThanOrEqual(3);
  });
});

describe("one-click suggestions", () => {
  const suggestionFor = (value: unknown, line = 11) => validateFindings([finding({ suggestion: value, line })], files)[0].suggestion;

  it("are offered only for added lines", () => {
    expect(suggestionFor("fix();", 10)).toBeNull();
    expect(suggestionFor("fix();", 11)).toBe("fix();");
  });

  it("cannot break out of their code block or be huge", () => {
    for (const bad of ["x\n```\nmalicious", "a\n".repeat(16), "y".repeat(2000), "   "]) expect(suggestionFor(bad)).toBeNull();
  });

  it("keep indentation and may span several lines", () => {
    expect(suggestionFor("  indented();\n\n")).toBe("  indented();");
    expect(suggestionFor("if (!row) {\n  return;\n}")).toBe("if (!row) {\n  return;\n}");
  });
});

describe("sanitizeText", () => {
  it("stops mentions, images, risky HTML, and fake suggestion blocks, but keeps ordinary code", () => {
    const dirty = "Ping @everyone and @alice! ![x](http://evil/p.png) <img src=x onerror=alert(1)> <script>bad()</script> ```suggestion\nrm -rf\n``` Use `Array<string>` here.";
    const clean = sanitizeText(dirty, 1000);
    expect(clean).toContain("@\u200beveryone");
    expect(clean.replace(/@\u200b/g, "")).not.toMatch(/@[a-z]/i);
    expect(clean).not.toContain("![");
    expect(clean).not.toMatch(/<img|<script/i);
    expect(clean).not.toMatch(/```suggestion/i);
    expect(clean).toContain("`Array<string>`");
  });

  it("limits length and cleans titles and explanations inside findings", () => {
    expect(sanitizeText("x".repeat(5000), 100)).toHaveLength(100);
    const [f] = validateFindings([finding({ title: "Hi @bob <a href=x>t</a>", explanation: "see <details>![i](u)</details> ok" })], files);
    expect(f.title).toContain("@\u200bbob");
    expect(f.title).not.toContain("<a");
    expect(f.explanation).not.toContain("![");
  });
});

describe("what gets posted", () => {
  const [f] = validateFindings([finding()], files);

  it("labels each comment as a suggestion to verify", () => {
    const text = formatCommentBody(f);
    expect(text.startsWith("**Security: Missing auth check**")).toBe(true);
    expect(text).toContain("```suggestion\nif (!user) return;\n```");
    expect(text).toContain("not a confirmed issue");
    expect(formatCommentBody({ ...f, suggestion: null })).not.toContain("```suggestion");
  });

  it("writes a summary that never claims the code is safe", () => {
    const two = validateFindings([finding(), finding({ line: 12, severity: "Performance", title: "p" })], files);
    const summary = buildSummary({ findings: two, reviewedFiles: 2, skippedFiles: 3, usedContext: false });
    expect(summary).toContain("Found 2 potential issues: 1 Security, 1 Performance.");
    expect(summary).toContain("3 files were not reviewed");
    expect(summary).toContain("diff only");
    expect(summary).toContain("does not mean the code is safe");

    const none = buildSummary({ findings: [], reviewedFiles: 1, skippedFiles: 0, usedContext: true });
    expect(none).toContain("No clear issues found");
    expect(none).not.toContain("diff only");
  });

  it("reads stored findings back defensively", () => {
    expect(parseStoredFindings([f, { bad: 1 }, null])).toHaveLength(1);
    expect(parseStoredFindings("x")).toEqual([]);
  });
});
