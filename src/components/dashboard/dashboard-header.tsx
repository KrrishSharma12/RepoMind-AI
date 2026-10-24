import Link from "next/link";
import { Braces } from "lucide-react";
import { SignOutButton } from "@/components/dashboard/sign-out-button";

interface DashboardHeaderProps {
  name: string;
  image?: string | null;
}

export function DashboardHeader({ name, image }: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3">
        <Link href="/dashboard" className="flex items-center gap-2 font-medium">
          <Braces className="size-5 text-accent" aria-hidden="true" />
          RepoMind AI
        </Link>

        <div className="flex min-w-0 items-center gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="" width={28} height={28} className="size-7 rounded-full border border-line" referrerPolicy="no-referrer" />
            ) : (
              <span aria-hidden="true" className="grid size-7 place-items-center rounded-full bg-accent/15 text-xs text-accent">
                {name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="hidden max-w-40 truncate text-sm sm:inline">{name}</span>
          </div>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}