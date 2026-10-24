"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm transition-colors hover:bg-panel disabled:opacity-70"
    >
      <LogOut className="size-4" aria-hidden="true" />
      <span className="hidden sm:inline">{pending ? "Signing out..." : "Sign out"}</span>
      <span className="sr-only sm:hidden">Sign out</span>
    </button>
  );
}