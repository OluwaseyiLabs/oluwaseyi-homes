"use client";

import { useEffect, useState } from "react";
import { NavIcon } from "./NavIcon";

/** The header links for small screens: a menu button that opens a panel under the header. */
export function MobileMenu({ links }: { links: { href: string; label: string; icon: string }[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((o) => !o)}
        className="grid size-11 place-items-center rounded-full border border-line bg-surface active:scale-[0.96]"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="size-5" aria-hidden>
          <path d={open ? "M6 6l12 12M18 6L6 18" : "M4 7h16M4 12h16M4 17h16"} />
        </svg>
      </button>
      {open && (
        <>
          {/* Tapping outside closes the menu. */}
          <button type="button" aria-label="Close menu" tabIndex={-1} onClick={() => setOpen(false)} className="fixed inset-0 top-16 z-30 cursor-default bg-ink/20" />
          <nav id="mobile-menu" aria-label="Menu" className="absolute inset-x-0 top-16 z-40 border-b border-line bg-ground px-5 py-3 shadow-sm">
            {links.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="flex min-h-12 items-center gap-3 border-b border-line/60 text-base font-semibold last:border-0">
                <NavIcon name={l.icon} className="size-5 text-green" />
                {l.label}
              </a>
            ))}
          </nav>
        </>
      )}
    </div>
  );
}
