import { describe, expect, it } from "vitest";
import { containsSecret, isSensitivePath, shouldIndexPath } from "@/lib/repo/indexable";
import { isIgnoredPath } from "@/lib/repo/ignore";
import { encodePath, isSafePath, isValidRepoPart } from "@/lib/repo/validate";
import { languageForPath } from "@/lib/repo/language";

describe("sensitive files are never indexed", () => {
  it.each([".env", ".env.local", "config/.env.production", "id_rsa", "certs/server.pem", "deploy.key", ".npmrc", "credentials.json"])(
    "%s",
    (path) => {
      expect(isSensitivePath(path)).toBe(true);
      expect(shouldIndexPath(path, 100)).toBe(false);
    },
  );

  it("allows .env.example, which holds no secrets", () => {
    expect(shouldIndexPath(".env.example", 100)).toBe(true);
  });
});

describe("shouldIndexPath", () => {
  it.each(["package-lock.json", "pnpm-lock.yaml", "a/app.min.js", "a/b.js.map", "logo.png", "font.woff2"])("skips %s", (path) => {
    expect(shouldIndexPath(path, 100)).toBe(false);
  });

  it.each(["src/index.ts", "src/App.tsx", "README.md", "Dockerfile", "prisma/schema.prisma", "api/main.py"])("indexes %s", (path) => {
    expect(shouldIndexPath(path, 500)).toBe(true);
  });

  it("applies the size limits", () => {
    expect(shouldIndexPath("a.ts", 0)).toBe(false);
    expect(shouldIndexPath("a.ts", 100_001)).toBe(false);
    expect(shouldIndexPath("a.ts", 100_000)).toBe(true);
  });
});

describe("containsSecret", () => {
  it("detects private keys and tokens", () => {
    expect(containsSecret("-----BEGIN RSA PRIVATE KEY-----\nabc")).toBe(true);
    expect(containsSecret("const k = 'AKIAIOSFODNN7EXAMPLE'")).toBe(true);
    expect(containsSecret(`token: ghp_${"a".repeat(36)}`)).toBe(true);
  });

  it("ignores ordinary code", () => {
    expect(containsSecret("const x = process.env.API_KEY; // sk- is a prefix")).toBe(false);
  });
});

describe("paths from the URL", () => {
  it("ignores dependency and build folders", () => {
    for (const p of ["node_modules/x/index.js", "a/dist/b.js", ".git/config", "vendor/lib.go", ".next/cache"]) expect(isIgnoredPath(p)).toBe(true);
    expect(isIgnoredPath("src/index.ts")).toBe(false);
  });

  it("accepts normal owner and repository names only", () => {
    for (const ok of ["alice", "my-repo", "repo.name_1"]) expect(isValidRepoPart(ok)).toBe(true);
    for (const bad of ["", "..", ".", "a/b", "a b", "../x", "x".repeat(101)]) expect(isValidRepoPart(bad)).toBe(false);
  });

  it("blocks path traversal and odd characters", () => {
    expect(isSafePath("src/app/page.tsx")).toBe(true);
    for (const bad of ["", "../secret", "a/../b", "/etc/passwd", "a\\b", "a\0b", "a//b", "./a", "x".repeat(1001)]) expect(isSafePath(bad)).toBe(false);
  });

  it("encodes each path segment but keeps the slashes", () => {
    expect(encodePath("src/my file/a#b.ts")).toBe("src/my%20file/a%23b.ts");
  });

  it("guesses a highlighting language from the file name", () => {
    expect(languageForPath("src/a.ts")).toBe("typescript");
    expect(languageForPath("Dockerfile")).toBe("docker");
    expect(languageForPath("notes.unknownext")).toBe("text");
  });
});
