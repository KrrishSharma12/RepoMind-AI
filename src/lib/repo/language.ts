const BY_EXTENSION: Record<string, string> = {
  ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx", mjs: "javascript", cjs: "javascript",
  json: "json", md: "markdown", mdx: "mdx", css: "css", scss: "scss", html: "html",
  py: "python", go: "go", rs: "rust", java: "java", kt: "kotlin", rb: "ruby", php: "php",
  c: "c", h: "c", cpp: "cpp", cs: "csharp", swift: "swift",
  sh: "bash", bash: "bash", zsh: "bash", yml: "yaml", yaml: "yaml", toml: "toml",
  sql: "sql", prisma: "prisma", graphql: "graphql", xml: "xml", vue: "vue", svelte: "svelte",
};

const BY_FILENAME: Record<string, string> = {
  dockerfile: "docker",
  makefile: "makefile",
};

/** Best guess at a syntax-highlighting language from the file name. */
export function languageForPath(path: string): string {
  const filename = (path.split("/").pop() ?? "").toLowerCase();
  if (BY_FILENAME[filename]) return BY_FILENAME[filename];
  const extension = filename.includes(".") ? filename.split(".").pop()! : "";
  return BY_EXTENSION[extension] ?? "text";
}