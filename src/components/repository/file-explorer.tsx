"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, FileCode, Folder, FolderOpen, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface TreeNode {
  name: string;
  path: string;
  children: TreeNode[] | null; // null means file
}

function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode = { name: "", path: "", children: [] };
  const index = new Map<string, TreeNode>([["", root]]);

  for (const filePath of paths) {
    const parts = filePath.split("/");
    let parent = root;
    parts.forEach((part, i) => {
      const fullPath = parts.slice(0, i + 1).join("/");
      let node = index.get(fullPath);
      if (!node) {
        node = { name: part, path: fullPath, children: i === parts.length - 1 ? null : [] };
        index.set(fullPath, node);
        parent.children!.push(node);
      }
      parent = node;
    });
  }

  const sort = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => Number(a.children === null) - Number(b.children === null) || a.name.localeCompare(b.name));
    nodes.forEach((n) => n.children && sort(n.children));
  };
  sort(root.children!);
  return root.children!;
}

function ancestorsOf(path: string | null): Set<string> {
  const result = new Set<string>();
  if (!path) return result;
  const parts = path.split("/");
  for (let i = 1; i < parts.length; i++) result.add(parts.slice(0, i).join("/"));
  return result;
}

interface FileExplorerProps {
  files: string[];
  selectedPath: string | null;
  baseHref: string;
  branch: string;
}

export function FileExplorer({ files, selectedPath, baseHref, branch }: FileExplorerProps) {
  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expanded, setExpanded] = useState(() => ancestorsOf(selectedPath));
  const tree = useMemo(() => buildTree(files), [files]);

  const trimmed = query.trim().toLowerCase();
  const matches = useMemo(
    () => (trimmed ? files.filter((f) => f.toLowerCase().includes(trimmed)).slice(0, 200) : []),
    [files, trimmed],
  );

  const hrefFor = (path: string) => `${baseHref}?path=${encodeURIComponent(path)}`;

  function toggle(path: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function renderNodes(nodes: TreeNode[], depth: number): React.ReactNode {
    return (
      <ul>
        {nodes.map((node) => {
          const indent = { paddingLeft: `${depth * 0.875 + 0.5}rem` };

          if (node.children) {
            const open = expanded.has(node.path);
            const Icon = open ? FolderOpen : Folder;
            return (
              <li key={node.path}>
                <button
                  type="button"
                  onClick={() => toggle(node.path)}
                  aria-expanded={open}
                  style={indent}
                  className="flex w-full items-center gap-1.5 rounded py-1 pr-2 text-left text-sm text-muted transition-colors hover:bg-panel hover:text-fg"
                >
                  <ChevronRight className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-90")} aria-hidden="true" />
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{node.name}</span>
                </button>
                {open && renderNodes(node.children, depth + 1)}
              </li>
            );
          }

          const selected = node.path === selectedPath;
          return (
            <li key={node.path}>
              <Link
                href={hrefFor(node.path)}
                prefetch={false}
                scroll={false}
                aria-current={selected ? "page" : undefined}
                onClick={() => setMobileOpen(false)}
                style={{ paddingLeft: `${depth * 0.875 + 1.5}rem` }}
                className={cn(
                  "flex items-center gap-1.5 rounded py-1 pr-2 text-sm transition-colors hover:bg-panel",
                  selected ? "bg-accent/15 text-fg" : "text-muted hover:text-fg",
                )}
              >
                <FileCode className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{node.name}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={() => setMobileOpen((v) => !v)}
        aria-expanded={mobileOpen}
        className="mb-3 flex w-full items-center justify-between rounded-lg border border-line px-3 py-2 text-sm lg:hidden"
      >
        <span className="flex items-center gap-2">
          <Folder className="size-4" aria-hidden="true" />
          Files
        </span>
        <span className="text-xs text-muted">{mobileOpen ? "Hide" : "Show"}</span>
      </button>

      <div className={cn("flex-col gap-3 lg:flex", mobileOpen ? "flex" : "hidden")}>
        <p className="text-xs text-muted">
          Branch: <span className="font-mono text-fg">{branch}</span>
        </p>

        <label className="relative block">
          <span className="sr-only">Search files</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search files"
            className="w-full rounded-lg border border-line bg-transparent py-2 pl-8 pr-3 text-sm placeholder:text-muted"
          />
        </label>

        <nav aria-label="Repository files" className="max-h-[60vh] overflow-y-auto pr-1 lg:max-h-[70vh]">
          {trimmed ? (
            matches.length === 0 ? (
              <p className="px-2 py-1 text-sm text-muted">No files match.</p>
            ) : (
              <ul>
                {matches.map((path) => (
                  <li key={path}>
                    <Link
                      href={hrefFor(path)}
                      prefetch={false}
                      scroll={false}
                      onClick={() => setMobileOpen(false)}
                      aria-current={path === selectedPath ? "page" : undefined}
                      className={cn(
                        "block break-all rounded px-2 py-1 font-mono text-xs transition-colors hover:bg-panel",
                        path === selectedPath ? "bg-accent/15 text-fg" : "text-muted hover:text-fg",
                      )}
                    >
                      {path}
                    </Link>
                  </li>
                ))}
              </ul>
            )
          ) : (
            renderNodes(tree, 0)
          )}
        </nav>
      </div>
    </div>
  );
}