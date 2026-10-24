import { ExternalLink } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { CopyButton } from "@/components/repository/copy-button";
import { GithubApiError, getFileContent } from "@/lib/github/api";
import { highlightCode } from "@/lib/repo/highlight";
import { languageForPath } from "@/lib/repo/language";
import { encodePath } from "@/lib/repo/validate";
import { MAX_FILE_BYTES } from "@/lib/repo/limits";

interface FileViewerProps {
  userToken: string;
  owner: string;
  name: string;
  branch: string;
  path: string;
}

function formatSize(bytes: number) {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="p-6 text-sm leading-relaxed text-muted">{children}</p>;
}

/** Fetches one file when it is opened, then shows it with syntax highlighting. */
export async function FileViewer({ userToken, owner, name, branch, path }: FileViewerProps) {
  const githubUrl = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/blob/${encodeURIComponent(branch)}/${encodePath(path)}`;
  const segments = path.split("/");

  let body: React.ReactNode;
  let meta = "";
  let showCopy = false;
  const codeId = "file-code";

  try {
    const file = await getFileContent(userToken, owner, name, path, branch);

    if (file.kind === "text") {
      const html = await highlightCode(file.text, languageForPath(path));
      meta = `${formatSize(file.size)}, ${file.text.split("\n").length} lines`;
      showCopy = true;
      body = <div id={codeId} className="code-view overflow-x-auto" dangerouslySetInnerHTML={{ __html: html }} />;
    } else if (file.kind === "binary") {
      body = <Notice>This looks like a binary file, so there is nothing to preview.</Notice>;
    } else if (file.kind === "too-large") {
      body = <Notice>This file is larger than the {formatSize(MAX_FILE_BYTES)} preview limit. Open it on GitHub to read it.</Notice>;
    } else {
      body = <Notice>This item is not a regular file, so it cannot be previewed.</Notice>;
    }
  } catch (error) {
    body = (
      <p role="alert" className="p-6 text-sm text-danger">
        {error instanceof GithubApiError && error.status === 404
          ? "GitHub could not find this file on the default branch."
          : "Could not load this file from GitHub. Please try again."}
      </p>
    );
  }

  return (
    <GlassCard className="min-w-0 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <nav aria-label="File path" className="min-w-0 break-all font-mono text-xs text-muted">
          {segments.map((segment, i) => (
            <span key={i}>
              {i > 0 && <span aria-hidden="true"> / </span>}
              <span className={i === segments.length - 1 ? "text-fg" : undefined}>{segment}</span>
            </span>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {meta && <span className="hidden text-xs text-muted sm:inline">{meta}</span>}
          {showCopy && <CopyButton targetId={codeId} />}
          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-xs transition-colors hover:bg-panel"
          >
            <ExternalLink className="size-3.5" aria-hidden="true" />
            Open on GitHub
          </a>
        </div>
      </div>
      {body}
    </GlassCard>
  );
}