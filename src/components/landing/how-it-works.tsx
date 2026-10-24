import { GlassCard } from "@/components/ui/glass-card";
import { HOW_STEPS } from "@/lib/constants/landing";

/** Vertical timeline on phones, 2x2 on tablets, one horizontal row on desktop. */
export function HowItWorks() {
  const last = HOW_STEPS.length - 1;

  return (
    <section id="how-it-works" className="mx-auto max-w-6xl px-5 py-16">
      <h2 className="max-w-xl text-2xl font-semibold tracking-tight sm:text-3xl">How it works</h2>

      <ol className="mt-10 grid grid-cols-1 md:grid-cols-2 md:gap-x-4 md:gap-y-8 lg:grid-cols-4">
        {HOW_STEPS.map(({ title, description, icon: Icon }, i) => (
          <li key={title} className="relative min-w-0 pb-8 pl-12 last:pb-0 md:pb-0 md:pl-0">
            {/* Phone: vertical connector between steps */}
            {i < last && <span aria-hidden="true" className="absolute bottom-0 left-4 top-9 w-px bg-line md:hidden" />}
            {/* Desktop: horizontal connector to the next step */}
            {i < last && <span aria-hidden="true" className="absolute -right-4 left-10 top-4 hidden h-px bg-line lg:block" />}

            <span className="absolute left-0 top-0 grid size-8 place-items-center rounded-full border border-line bg-bg text-sm font-medium text-accent md:static md:mb-4">
              {i + 1}
            </span>

            <GlassCard className="p-4 md:h-[calc(100%-3rem)] md:p-5">
              <Icon className="size-5 text-accent" aria-hidden="true" />
              <h3 className="mt-3 font-medium">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>
            </GlassCard>
          </li>
        ))}
      </ol>
    </section>
  );
}