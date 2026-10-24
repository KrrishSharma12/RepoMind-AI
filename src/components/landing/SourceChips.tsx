export function SourceChips({ sources }: { sources: { path: string; lines: string }[] }) {
  return (
    <ul aria-label="Sources" className="flex flex-wrap gap-2">
      {sources.map((s) => (
        <li key={s.path} className="max-w-full truncate rounded-md border border-line px-2 py-1 font-mono text-xs text-muted">
          {s.path}:{s.lines}
        </li>
      ))}
    </ul>
  );
}