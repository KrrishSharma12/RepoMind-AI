import { cn } from "@/lib/utils";

/**
 * Reusable frosted panel. Falls back to a solid surface when
 * backdrop-filter is unsupported so text stays readable.
 */
export function GlassCard({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-xl border border-line bg-[#221f19] supports-[backdrop-filter]:bg-panel supports-[backdrop-filter]:backdrop-blur-md",
        className,
      )}
      {...props}
    />
  );
}