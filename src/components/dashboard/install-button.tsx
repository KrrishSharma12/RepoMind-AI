import { getInstallUrl } from "@/lib/github/config";
import { cn } from "@/lib/utils";

const base = "inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition-colors";

/** Opens GitHub's page where the user picks which repositories to share. */
export function InstallButton({ children = "Install on GitHub", variant = "primary" }: { children?: React.ReactNode; variant?: "primary" | "outline" }) {
  const url = getInstallUrl();
  const style = variant === "primary" ? "bg-accent text-accent-fg hover:brightness-110" : "border border-line hover:bg-panel";

  if (!url) {
    return (
      <span aria-disabled="true" className={cn(base, "cursor-not-allowed border border-line text-muted")}>
        Set GITHUB_APP_SLUG to enable install
      </span>
    );
  }

  return (
    <a href={url} className={cn(base, style)}>
      {children}
    </a>
  );
}