import Link from "next/link";
import { Braces } from "lucide-react";
import { NAV_LINKS } from "@/lib/constants/landing";
import { GithubButton } from "@/components/ui/github-button";
import { SignInLink } from "@/components/ui/SignInLink";
import { MobileMenu } from "@/components/landing/MobileMenu";

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
        <Link href="/" className="flex items-center gap-2 font-medium">
          <Braces className="size-5 text-accent" aria-hidden="true" />
          RepoMind AI
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-7 text-sm text-muted lg:flex">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="transition-colors hover:text-fg">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <SignInLink />
          <GithubButton className="px-3 py-1.5" />
        </div>

        <MobileMenu>
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="rounded-lg px-3 py-3 text-base text-muted transition-colors hover:bg-panel hover:text-fg">
              {l.label}
            </a>
          ))}
          <div className="mt-3 flex flex-col gap-3">
            <SignInLink className="py-2.5" />
            <GithubButton />
          </div>
        </MobileMenu>
      </div>
    </header>
  );
}