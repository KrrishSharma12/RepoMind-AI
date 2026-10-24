import { ArrowDown, ArrowRight, GitPullRequest, MessageSquare } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { ENGINE_CAPABILITIES } from "@/lib/constants/landing";

function Connector() {
  return (
    <div className="grid place-items-center py-1 text-muted lg:px-1 lg:py-0" aria-hidden="true">
      <ArrowDown className="size-5 lg:hidden" />
      <ArrowRight className="hidden size-5 lg:block" />
    </div>
  );
}

export function SharedEngine() {
  return (
    <section id="shared-engine" className="mx-auto max-w-6xl px-5 py-16">
      <h2 className="max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">
        One Code Intelligence Engine. Two Powerful Workflows.
      </h2>
      <p className="mt-3 max-w-xl leading-relaxed text-muted">
        Repository chat and pull request review run on the same code understanding layer, so both answer from your actual source.
      </p>

      <div className="mt-10 flex flex-col lg:flex-row lg:items-stretch">
        <GlassCard className="min-w-0 flex-1 p-5 sm:p-6">
          <h3 className="font-medium">Shared code intelligence</h3>
          <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {ENGINE_CAPABILITIES.map(({ title, icon: Icon }) => (
              <li key={title} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-accent/15 text-accent">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span className="leading-relaxed">{title}</span>
              </li>
            ))}
          </ul>
        </GlassCard>

        <Connector />

        <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row lg:flex-col">
          <GlassCard className="min-w-0 flex-1 p-5">
            <MessageSquare className="size-5 text-accent" aria-hidden="true" />
            <h3 className="mt-3 font-medium">AI Repository Chat</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">Answers questions using retrieved code and cites the files it used.</p>
          </GlassCard>
          <GlassCard className="min-w-0 flex-1 p-5">
            <GitPullRequest className="size-5 text-accent" aria-hidden="true" />
            <h3 className="mt-3 font-medium">AI Code Review</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">Reviews pull request changes alongside related code elsewhere in the repository.</p>
          </GlassCard>
        </div>
      </div>
    </section>
  );
}