import { GlassCard } from "@/components/ui/glass-card";
import { GithubButton } from "@/components/ui/github-button";

export function FinalCta() {
  return (
    <section id="get-started" className="mx-auto max-w-6xl px-5 pb-20 pt-8">
      <GlassCard className="px-6 py-12 text-center sm:py-16">
        <h2 className="mx-auto max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">
          Your Next Repository Deserves Better Intelligence.
        </h2>
        <p className="mx-auto mt-4 max-w-lg leading-relaxed text-muted">
          Explore your codebase with AI and review pull requests with greater context.
        </p>
        <div className="mt-8 flex justify-center">
          <GithubButton>Get Started with GitHub</GithubButton>
        </div>
        <p className="mt-3 text-sm text-muted">GitHub sign-in is not available yet. RepoMind AI is in development.</p>
      </GlassCard>
    </section>
  );
}