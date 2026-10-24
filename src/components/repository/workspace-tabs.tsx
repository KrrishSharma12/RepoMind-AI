import Link from "next/link";
import { Code2, GitPullRequest, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export type WorkspaceTab = "code" | "chat" | "reviews";

export function WorkspaceTabs({ baseHref, active }: { baseHref: string; active: WorkspaceTab }) {
  const tab = (isActive: boolean) =>
    cn(
      "inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm transition-colors",
      isActive ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg",
    );

  return (
    <nav aria-label="Workspace sections" className="flex gap-1 overflow-x-auto border-b border-line">
      <Link href={baseHref} aria-current={active === "code" ? "page" : undefined} className={tab(active === "code")}>
        <Code2 className="size-4" aria-hidden="true" />
        Code
      </Link>
      <Link href={`${baseHref}?tab=chat`} aria-current={active === "chat" ? "page" : undefined} className={tab(active === "chat")}>
        <MessageSquare className="size-4" aria-hidden="true" />
        Chat
      </Link>
      <Link href={`${baseHref}?tab=reviews`} aria-current={active === "reviews" ? "page" : undefined} className={tab(active === "reviews")}>
        <GitPullRequest className="size-4" aria-hidden="true" />
        Reviews
      </Link>
    </nav>
  );
}