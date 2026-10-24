import { BENEFITS } from "@/lib/constants/landing";

export function Benefits() {
  return (
    <section id="for-developers" className="mx-auto max-w-6xl px-5 py-16">
      <h2 className="max-w-xl text-2xl font-semibold tracking-tight sm:text-3xl">Built for developers</h2>

      <ul className="mt-8 grid grid-cols-1 gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
        {BENEFITS.map(({ title, description, icon: Icon }) => (
          <li key={title} className="border-t border-line pt-5">
            <Icon className="size-5 text-accent" aria-hidden="true" />
            <h3 className="mt-3 font-medium">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}