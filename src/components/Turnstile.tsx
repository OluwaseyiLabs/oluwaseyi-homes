"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";

interface TurnstileApi {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
}

export interface TurnstileHandle {
  /** A token works once. Call this after every request so the next one gets a fresh token. */
  reset: () => void;
}

/** The public key. When it is not set there is no CAPTCHA at all (for example on a developer's machine). */
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

let loading: Promise<TurnstileApi> | null = null;
/** Loads Cloudflare's script once for the whole page. */
function loadScript(): Promise<TurnstileApi> {
  const w = window as unknown as { turnstile?: TurnstileApi };
  if (w.turnstile) return Promise.resolve(w.turnstile);
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const el = document.createElement("script");
    el.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    el.async = true;
    el.onload = () => (w.turnstile ? resolve(w.turnstile) : reject(new Error("Turnstile did not start")));
    el.onerror = () => {
      loading = null;
      reject(new Error("Turnstile did not load"));
    };
    document.head.appendChild(el);
  });
  return loading;
}

/**
 * Cloudflare Turnstile. Most visitors see nothing at all: the check runs in the background and a token arrives in
 * `onToken`. Only if Cloudflare is unsure does it show a small challenge. `onToken("")` means the token was used up,
 * expired or failed, so the form must wait for a new one. `onProblem(true)` means the check could not run at all
 * (for example an ad blocker stopped it), so the visitor should be told rather than left waiting.
 */
export function Turnstile({ action, onToken, onProblem, ref }: { action: string; onToken: (token: string) => void; onProblem?: (broken: boolean) => void; ref?: Ref<TurnstileHandle> }) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const api = useRef<TurnstileApi | null>(null);
  const callback = useRef(onToken);
  callback.current = onToken;
  const problem = useRef(onProblem);
  problem.current = onProblem;

  useImperativeHandle(ref, () => ({
    reset: () => {
      callback.current("");
      if (api.current && widget.current) api.current.reset(widget.current);
    },
  }));

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !box.current) return;
    let cancelled = false;
    loadScript()
      .then((t) => {
        if (cancelled || !box.current) return;
        api.current = t;
        widget.current = t.render(box.current, {
          sitekey: TURNSTILE_SITE_KEY,
          action,
          theme: document.documentElement.dataset.theme === "dark" ? "dark" : "light",
          // Always shown, so every visitor (Safari and other iPhone browsers included) sees the check run and finish.
          appearance: "always",
          size: "flexible",
          callback: (token: string) => {
            problem.current?.(false);
            callback.current(token);
          },
          "expired-callback": () => callback.current(""),
          // The check itself failed (blocked by a privacy tool, no connection...): tell the form so it can say so.
          "error-callback": () => {
            callback.current("");
            problem.current?.(true);
            return true;
          },
        });
      })
      .catch(() => {
        callback.current("");
        problem.current?.(true);
      });
    return () => {
      cancelled = true;
      if (api.current && widget.current) api.current.remove(widget.current);
      widget.current = null;
    };
  }, [action]);

  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={box} aria-label="Security check" className="my-1 min-h-[65px] w-full" />;
}
