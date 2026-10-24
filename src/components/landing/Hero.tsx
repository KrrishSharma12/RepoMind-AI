import { HeroPreview } from "@/components/landing/Hero-Preview";

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      {/* One restrained glow behind the hero, not a gradient wash. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 right-[8%] -z-10 size-72 rounded-full bg-accent/15 blur-3xl"
      />

      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-5 pb-16 pt-12 sm:pb-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:pt-20">
        <div className="hero-in min-w-0">
          <h1 className="max-w-xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
            Understand Your Codebase. Ship Better Code.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-muted">
            Chat with your entire repository, uncover hidden code relationships, and catch bugs before they reach production, all powered by AI.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href="#features"
              className="inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-fg transition-colors hover:brightness-110"
            >
              Explore Features
            </a>
            <a
              href="#how-it-works"
              className="inline-flex items-center justify-center rounded-lg border border-line px-4 py-2.5 text-sm transition-colors hover:bg-panel"
            >
              See How It Works
            </a>
          </div>

          <p className="mt-4 max-w-md text-sm text-muted">
            RepoMind AI is in development. This page previews what we are building, using sample data.
          </p>
        </div>

        <div className="hero-in hero-in-delay min-w-0">
          <HeroPreview />
        </div>
      </div>
    </section>
  );
}