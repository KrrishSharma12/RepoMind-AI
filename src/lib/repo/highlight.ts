import "server-only";
import { bundledLanguages, codeToHtml } from "shiki";

/**
 * Turns source code into highlighted HTML on the server. Shiki escapes the
 * code itself, so the result is safe to render with dangerouslySetInnerHTML.
 */
export async function highlightCode(code: string, lang: string): Promise<string> {
  const language = lang in bundledLanguages ? lang : "text";
  return codeToHtml(code, { lang: language, theme: "github-dark-default" });
}