"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

/**
 * Small client island for the phone/tablet menu. Links and buttons are passed
 * in as children from the server-rendered Navbar, so they stay server components.
 */
export function MobileMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((v) => !v)}
        className="grid size-10 place-items-center rounded-lg border border-line transition-colors hover:bg-panel"
      >
        {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
      </button>

      {open && (
        <div
          id="mobile-nav"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("a")) setOpen(false);
          }}
          className="absolute inset-x-0 top-full flex flex-col gap-1 border-b border-line bg-bg p-5"
        >
          {children}
        </div>
      )}
    </div>
  );
}