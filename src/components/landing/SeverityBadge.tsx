import { cn } from "@/lib/utils";
import type { Severity } from "@/lib/constants/landing";

const STYLES: Record<Severity, string> = {
  Security: "bg-danger/15 text-danger",
  "Potential Bug": "bg-accent/15 text-accent",
  Performance: "bg-white/10 text-fg",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={cn("inline-block rounded-md px-2 py-0.5 text-xs font-medium", STYLES[severity])}>
      {severity}
    </span>
  );
}