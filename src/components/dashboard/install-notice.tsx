"use client";

import { useSearchParams } from "next/navigation";

const MESSAGES: Record<string, { text: string; ok?: boolean }> = {
  ok: { text: "RepoMind AI is installed. The repositories you chose are listed below.", ok: true },
  pending: { text: "Your install request is waiting for an organization owner to approve it on GitHub." },
  denied: { text: "That installation does not belong to your GitHub account, so it was not saved." },
  reauth: { text: "Please sign out and sign in again, then retry the install." },
  invalid: { text: "GitHub did not send a valid installation. Please try installing again." },
  failed: { text: "We could not save the installation. Please try again." },
};

export function InstallNotice() {
  const key = useSearchParams().get("install");
  const message = key ? MESSAGES[key] : undefined;
  if (!message) return null;

  return (
    <p
      role={message.ok ? "status" : "alert"}
      className={`mt-6 rounded-lg border border-line px-4 py-3 text-sm ${message.ok ? "bg-ok/10" : "bg-danger/10"}`}
    >
      {message.text}
    </p>
  );
}