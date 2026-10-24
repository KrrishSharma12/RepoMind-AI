import { GitPullRequest, MessageSquare, type LucideIcon } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { ChatMockup } from "@/components/landing/ChatMockup";
import { ReviewMockup } from "@/components/landing/ReviewMockup";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  note?: string;
  cta: string;
  children: React.ReactNode;
}

function FeatureCard({ icon: Icon, title, description, note, cta, children }: FeatureCardProps) {
  return (
    <GlassCard className="flex min-w-0 flex-col p-5 transition-colors hover:border-white/25 sm:p-6">
      <span className="grid size-9 place-items-center rounded-lg bg-accent/15 text-accent">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-xl font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 leading-relaxed text-muted">{description}</p>
      {note && <p className="mt-2 text-sm leading-relaxed text-muted">{note}</p>}

      <div className="mt-6 min-w-0">{children}</div>

      <a
        href="#shared-engine"
        className="mt-6 inline-flex w-fit items-center rounded-lg border border-line px-4 py-2 text-sm transition-colors hover:bg-panel"
      >
        {cta}
      </a>
    </GlassCard>
  );
}

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-5 py-16">
      <h2 className="max-w-xl text-2xl font-semibold tracking-tight sm:text-3xl">
        Two ways to work with your code
      </h2>

      <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <FeatureCard
          icon={MessageSquare}
          title="Your Entire Codebase. One Conversation."
          description="Ask questions about any connected repository. RepoMind AI retrieves relevant code and explains how your application works, with source references you can verify."
          cta="Explore Repository Chat"
        >
          <ChatMockup />
        </FeatureCard>

        <FeatureCard
          icon={GitPullRequest}
          title="Catch Bugs Before They Ship."
          description="Automatically analyze pull requests for potential bugs, security risks, performance issues, and maintainability problems. Get contextual suggestions right where your team works."
          note="Reviews use relevant code from across the repository, not just the changed lines."
          cta="Explore AI Code Review"
        >
          <ReviewMockup />
        </FeatureCard>
      </div>
    </section>
  );
}