"use client";

import { useSearchParams } from "next/navigation";

const MESSAGES: Record<string, string> = {
  access_denied: "GitHub sign-in was cancelled. You can try again whenever you like.",
};

/** Shows a friendly banner when GitHub sends the visitor back with an error (for example, Cancel). */
export function AuthNotice() {
  const error = useSearchParams().get("error");
  if (!error) return null;

  return (
    <div role="alert" className="border-b border-line bg-danger/10 px-5 py-3 text-center text-sm">
      {MESSAGES[error] ?? "Sign-in did not complete. Please try again."}
    </div>
  );
}