"use client";

import { cn } from "@/lib/utils";
import { AUTH_ENABLED } from "@/lib/constants/landing";
import { useGithubSignIn } from "@/lib/auth/use-github-sign-in";

function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("size-4 fill-current", className)}>
      <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
    </svg>
  );
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-fg transition-colors";

interface GithubButtonProps {
  children?: React.ReactNode;
  className?: string;
}

/** Signs the visitor in with GitHub. Renders a disabled placeholder while AUTH_ENABLED is false. */
export function GithubButton({ children = "Connect GitHub", className }: GithubButtonProps) {
  const { signIn, pending, error } = useGithubSignIn();

  if (!AUTH_ENABLED) {
    return (
      <button type="button" disabled title="GitHub sign-in is coming soon" className={cn(base, "cursor-not-allowed opacity-70", className)}>
        <GithubMark />
        {children}
        <span className="sr-only"> (coming soon)</span>
      </button>
    );
  }

  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        onClick={signIn}
        disabled={pending}
        className={cn(base, "hover:brightness-110 disabled:cursor-wait disabled:opacity-80", className)}
      >
        <GithubMark />
        {pending ? "Redirecting to GitHub..." : children}
      </button>
      {error && (
        <span role="alert" className="mt-2 text-sm text-danger">
          {error}
        </span>
      )}
    </span>
  );
}