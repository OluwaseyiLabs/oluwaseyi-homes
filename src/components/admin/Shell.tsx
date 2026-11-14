"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { signOut } from "@/app/admin/actions";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useSite } from "@/components/SiteProvider";
import { Icon } from "./ui";


/** `needs` is the permission a role must have to see the page. */
const nav: { href: string; label: string; icon: string; needs: string }[] = [
  { href: "/admin", needs: "view", label: "Dashboard", icon: "dashboard" },
  { href: "/admin/properties", needs: "view", label: "Properties", icon: "home" },
  { href: "/admin/submissions", needs: "submissions", label: "Submissions", icon: "inbox" },
  { href: "/admin/leads", needs: "view", label: "Leads & transactions", icon: "mail" },
  { href: "/admin/content", needs: "content", label: "Website content", icon: "edit" },
  { href: "/admin/legal", needs: "content", label: "Legal pages", icon: "sheet" },
  { href: "/admin/traffic", needs: "view", label: "Traffic", icon: "chart" },
  { href: "/admin/team", needs: "team", label: "Team", icon: "users" },
];

interface Waiting {
  id: string;
  name: string;
  type: string;
  propertyType: string;
  location: string;
}

interface Unread {
  id: string;
  purpose: string;
  propertyType: string;
  place: string;
}

function Bell({ waiting, unread }: { waiting: Waiting[]; unread: Unread[] }) {
  const alerts = unread.length + waiting.length;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={`Notifications, ${alerts} new`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="relative grid size-11 place-items-center rounded-full border border-line bg-surface transition hover:border-ink active:scale-95"
      >
        <Icon name="bell" />
        {alerts > 0 && (
          <span className="absolute -right-1 -top-1 grid grid-cols-1 min-w-5 place-items-center rounded-full bg-gold px-1 text-xs font-bold text-coal">
            {alerts}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 max-h-[75svh] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto glass-panel rounded-2xl border border-white/60 p-2 shadow-xl shadow-ink/10">
          <p className="px-3 py-2 text-sm font-bold">Enquiries waiting for your approval</p>
          {waiting.map((l) => (
            <Link
              key={l.id}
              href={`/admin/leads?id=${l.id}`}
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3 py-2.5 transition hover:bg-panel"
            >
              <span className="block text-sm font-semibold">
                {l.name} wants to {l.type.toLowerCase()}: {l.propertyType}
              </span>
              <span className="block truncate text-sm text-muted">{l.id} · {l.location}</span>
            </Link>
          ))}
          <p className="mt-1 border-t border-line px-3 pb-2 pt-3 text-sm font-bold">New property submissions</p>
          {unread.map((s) => (
            <Link
              key={s.id}
              href={`/admin/submissions?id=${s.id}`}
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3 py-2.5 transition hover:bg-panel"
            >
              <span className="block text-sm font-semibold">
                New property to {s.purpose === "Rent" ? "rent" : "sell"}: {s.propertyType}
              </span>
              <span className="block truncate text-sm text-muted">{s.id} · {s.place}</span>
            </Link>
          ))}
          <Link
            href="/admin/submissions"
            onClick={() => setOpen(false)}
            className="mt-1 block rounded-xl px-3 py-2.5 text-sm font-semibold text-green transition hover:bg-panel"
          >
            See all submissions
          </Link>
        </div>
      )}
    </div>
  );
}

export function Shell({
  children,
  user,
  sheetUrl,
  waiting,
  unread,
}: {
  children: ReactNode;
  user: { name: string; role: string; permissions: string[] };
  /** The lead sheet the enquiry workflow adds rows to. Comes from LEAD_SHEET_URL; the link is hidden when it is not set. */
  sheetUrl?: string;
  /** Leads waiting for approval. */
  waiting: Waiting[];
  /** Owner submissions nobody has opened yet. */
  unread: Unread[];
}) {
  const badges: Record<string, number> = { "/admin/leads": waiting.length, "/admin/submissions": unread.length };
  const path = usePathname();
  const company = useSite().site.name;
  const [menu, setMenu] = useState(false);

  return (
    <div className="min-h-svh bg-panel text-ink lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)]">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[16.5rem] flex-col border-r border-line bg-surface p-4 transition-transform duration-300 lg:sticky lg:top-0 lg:h-svh lg:translate-x-0 ${
          menu ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <p className="px-3 py-3 text-[15px] font-extrabold leading-tight tracking-[-0.03em]">{company}.</p>
        <p className="px-3 text-xs font-medium text-muted">Admin</p>
        <nav aria-label="Admin" className="mt-5 grid grid-cols-1 gap-1">
          {nav.filter((n) => user.permissions.includes(n.needs)).map((n) => {
            const active = n.href === "/admin" ? path === "/admin" : path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setMenu(false)}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${
                  active ? "bg-green text-white" : "text-muted hover:bg-panel hover:text-ink"
                }`}
              >
                <Icon name={n.icon} />
                {n.label}
                {badges[n.href] ? (
                  <span className="ml-auto grid grid-cols-1 min-w-5 place-items-center rounded-full bg-gold px-1 text-xs font-bold text-coal">
                    {badges[n.href]}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        {sheetUrl && (
          <a
            href={sheetUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-auto flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted transition hover:bg-panel hover:text-ink"
          >
            <Icon name="sheet" />
            Google Sheet
          </a>
        )}
        <Link
          href="/"
          className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted transition hover:bg-panel hover:text-ink"
        >
          <Icon name="external" />
          View website
        </Link>
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <span className="text-sm font-semibold text-muted">Theme</span>
          <ThemeToggle />
        </div>
        <form action={signOut}>
          <button className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted transition hover:bg-panel hover:text-ink">
            <Icon name="logout" />
            Sign out
          </button>
        </form>
      </aside>
      {menu && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setMenu(false)}
          className="fixed inset-0 z-30 bg-ink/40 lg:hidden"
        />
      )}

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 glass-bar-panel border-b border-line/70 px-5 sm:px-8">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMenu(true)}
            className="grid size-11 place-items-center rounded-full border border-line bg-surface lg:hidden"
          >
            <Icon name="menu" />
          </button>
          <div className="ml-auto flex items-center gap-3">
            <Bell waiting={waiting} unread={unread} />
            <Link href="/admin/account" aria-label="Your account" className="flex items-center gap-2.5 rounded-full border border-line bg-surface py-1.5 pl-1.5 pr-4 transition hover:border-green">
              <span className="grid size-8 place-items-center rounded-full bg-green text-sm font-bold text-white">
                {user.name[0].toUpperCase()}
              </span>
              <span className="text-sm leading-tight">
                <span className="block font-semibold">{user.name}</span>
                <span className="block text-xs text-muted">{user.role}</span>
              </span>
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
