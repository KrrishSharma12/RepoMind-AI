import { FOOTER_LINKS } from "@/lib/constants/landing";

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-8 text-sm text-muted md:flex-row md:items-center md:justify-between">
        <p className="font-medium text-fg">RepoMind AI</p>

        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
          {FOOTER_LINKS.working.map((l) => (
            <a key={l.href} href={l.href} className="transition-colors hover:text-fg">
              {l.label}
            </a>
          ))}
          {/* Pages that do not exist yet render as inert text, not fake links. */}
          {FOOTER_LINKS.soon.map((label) => (
            <span key={label} aria-disabled="true" title="Coming soon" className="cursor-not-allowed opacity-60">
              {label}
            </span>
          ))}
        </nav>
      </div>
    </footer>
  );
}