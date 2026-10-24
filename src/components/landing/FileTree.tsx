import { FileCode, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TreeNode } from "@/lib/constants/landing";

export function FileTree({ nodes, className }: { nodes: TreeNode[]; className?: string }) {
  return (
    <ul aria-label="Example file tree" className={cn("space-y-0.5 font-mono text-xs", className)}>
      {nodes.map((n, i) => {
        const Icon = n.kind === "dir" ? FolderOpen : FileCode;
        return (
          <li
            key={i}
            style={{ marginLeft: `${n.depth * 0.75}rem` }}
            className={cn("flex items-center gap-1.5 rounded px-1.5 py-0.5 text-muted", n.active && "bg-accent/15 text-fg")}
          >
            <Icon className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{n.name}</span>
          </li>
        );
      })}
    </ul>
  );
}