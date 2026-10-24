"use client";

import { useEffect, useState } from "react";
import type { IndexState } from "@/lib/rag/index-state";

const dateFormat = new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });

interface IndexPanelProps {
  owner: string;
  name: string;
  initial: IndexState;
}

/** The Index button, its progress bar, and the result. Polls the status route while a job runs. */
export function IndexPanel({ owner, name, initial }: IndexPanelProps) {
  const [state, setState] = useState<IndexState>(initial);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const base = `/api/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/index`;
  const active = state.job?.status === "QUEUED" || state.job?.status === "RUNNING";

  async function refresh() {
    try {
      const response = await fetch(`${base}/status`, { cache: "no-store" });
      if (response.ok) setState((await response.json()) as IndexState);
    } catch {
      // A missed poll is fine. The next one will catch up.
    }
  }

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(refresh, 2000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, base]);

  async function start() {
    setStarting(true);
    setError(null);
    try {
      const response = await fetch(base, { method: "POST" });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok && response.status !== 409) setError(body.error ?? "Could not start indexing.");
      else if (response.status === 409) setError(body.error ?? "An indexing job is already running.");
      await refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setStarting(false);
    }
  }

  const job = state.job;
  const percent = job && job.totalFiles > 0 ? Math.round((job.processedFiles / job.totalFiles) * 100) : 0;
  const label = active ? "Indexing..." : state.status === "INDEXED" ? "Re-index" : state.status === "FAILED" ? "Try again" : "Index repository";

  return (
    <div className="flex w-full flex-col gap-2 sm:w-72">
      <button
        type="button"
        onClick={start}
        disabled={starting || active}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {starting ? "Starting..." : label}
      </button>

      {active && job && (
        <div aria-live="polite">
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-label="Indexing progress"
            className="h-1.5 overflow-hidden rounded-full bg-white/10"
          >
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-muted">
            {job.phase ?? "Working"}: {job.processedFiles} of {job.totalFiles} files, {job.totalChunks} code pieces
          </p>
        </div>
      )}

      {!active && state.status === "INDEXED" && (
        <p className="text-xs text-muted">
          Indexed {state.fileCount} files, {state.chunkCount} code pieces
          {state.lastIndexedAt ? `, ${dateFormat.format(new Date(state.lastIndexedAt))}` : ""}.
          {job && job.skippedFiles > 0 ? ` ${job.skippedFiles} files were skipped (size, type, or limits).` : ""}
        </p>
      )}

      {!active && state.status === "NOT_INDEXED" && (
        <p className="text-xs text-muted">Not indexed yet. Indexing reads the code so chat can search it.</p>
      )}

      {!active && state.status === "FAILED" && job?.errorMessage && (
        <p role="alert" className="text-xs text-danger">
          {job.errorMessage}
        </p>
      )}

      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}