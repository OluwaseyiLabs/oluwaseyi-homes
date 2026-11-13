"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** Paths nobody should be counted on: the dashboard and the private links in emails. */
const quiet = (path: string) => path.startsWith("/admin") || path.startsWith("/r/") || path.startsWith("/track");

function send(body: object) {
  try {
    const data = JSON.stringify(body);
    if (!navigator.sendBeacon?.("/api/track", new Blob([data], { type: "application/json" })))
      fetch("/api/track", { method: "POST", body: data, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
  } catch {
    // Counting visits must never get in the way of the page.
  }
}

/** Counts one visit per page load, and the clicks on buttons marked with data-track. No cookies are set. */
export function Tracker() {
  const path = usePathname();

  useEffect(() => {
    if (quiet(path)) return;
    send({ path, referrer: document.referrer, utm: new URLSearchParams(window.location.search).get("utm_source") ?? "" });
  }, [path]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.("[data-track]");
      const event = el?.getAttribute("data-track");
      if (event && !quiet(window.location.pathname)) send({ path: window.location.pathname, event });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}

/** Counts something that is not a click, such as a form that was sent. */
export function trackEvent(event: string) {
  if (!quiet(window.location.pathname)) send({ path: window.location.pathname, event });
}
