"use client";

import { cn } from "@/lib/utils";
import { AUTH_ENABLED } from "@/lib/constants/landing";
import { useGithubSignIn } from "@/lib/auth/use-github-sign-in";

const base = "rounded-lg border border-line px-3 py-1.5 text-center text-sm";

/** "Sign In" in the navbar. Uses the same GitHub login as the main button. */
export function SignInLink({ className }: { className?: string }) {
  const { signIn, pending, error } = useGithubSignIn();

  if (!AUTH_ENABLED) {
    return (
      <span aria-disabled="true" title="Sign-in is coming soon" className={cn(base, "cursor-not-allowed text-muted", className)}>
        Sign In
        <span className="sr-only"> (coming soon)</span>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={signIn}
      disabled={pending}
      className={cn(base, "transition-colors hover:bg-panel disabled:cursor-wait disabled:opacity-70", className)}
    >
      {pending ? "Redirecting..." : error ? "Try again" : "Sign In"}
    </button>
  );
}