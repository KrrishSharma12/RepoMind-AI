/**
 * Decides which files are worth indexing and which must never be read.
 * Pure functions with no imports, so they are easy to test.
 */

const MAX_BYTES = 100_000;

const INDEXABLE_EXTENSIONS = new Set([
  "ts", "tsx", "js", "jsx", "mjs", "cjs", "json", "md", "mdx", "css", "scss", "html",
  "py", "go", "rs", "java", "kt", "rb", "php", "c", "h", "cpp", "cs", "swift",
  "sh", "yml", "yaml", "toml", "sql", "prisma", "graphql", "xml", "vue", "svelte", "txt",
]);

const INDEXABLE_FILENAMES = new Set(["dockerfile", "makefile"]);

const LOCKFILES = new Set([
  "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "composer.lock",
  "cargo.lock", "poetry.lock", "go.sum", "bun.lockb", "gemfile.lock",
]);

const SENSITIVE_NAMES = new Set([
  "id_rsa", "id_dsa", "id_ecdsa", "id_ed25519", ".npmrc", ".netrc", ".git-credentials",
  "credentials", "credentials.json", "secrets.json", "secrets.yml", "secrets.yaml",
]);

const SENSITIVE_EXTENSIONS = new Set(["pem", "key", "p12", "pfx", "jks", "keystore"]);

const SAFE_ENV_FILES = new Set([".env.example", ".env.sample", ".env.template"]);

/** Files that may hold secrets. Never fetch these. */
export function isSensitivePath(path: string): boolean {
  const name = (path.split("/").pop() ?? "").toLowerCase();
  if (name.startsWith(".env") && !SAFE_ENV_FILES.has(name)) return true;
  if (SENSITIVE_NAMES.has(name)) return true;
  const extension = name.includes(".") ? name.split(".").pop()! : "";
  return SENSITIVE_EXTENSIONS.has(extension);
}

/** True if the path looks like source or docs that is worth searching. */
export function shouldIndexPath(path: string, size?: number): boolean {
  if (isSensitivePath(path)) return false;

  const name = (path.split("/").pop() ?? "").toLowerCase();
  if (LOCKFILES.has(name)) return false;
  if (name.endsWith(".min.js") || name.endsWith(".min.css") || name.endsWith(".map") || name.endsWith(".bundle.js")) return false;

  if (size !== undefined && (size <= 0 || size > MAX_BYTES)) return false;

  if (INDEXABLE_FILENAMES.has(name) || SAFE_ENV_FILES.has(name)) return true;
  const extension = name.includes(".") ? name.split(".").pop()! : "";
  return INDEXABLE_EXTENSIONS.has(extension);
}

const SECRET_PATTERNS: RegExp[] = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/, // AWS access key id
  /\bgh[pousr]_[A-Za-z0-9]{36,}\b/, // GitHub tokens
  /\bgithub_pat_[A-Za-z0-9_]{50,}\b/,
  /\bsk-[A-Za-z0-9_-]{32,}\b/, // common secret-key shape
  /\bAIza[0-9A-Za-z_-]{35}\b/, // Google API key
];

/** If a file's text contains something that looks like a real secret, we skip the whole file. */
export function containsSecret(text: string): boolean {
  return SECRET_PATTERNS.some((pattern) => pattern.test(text));
}