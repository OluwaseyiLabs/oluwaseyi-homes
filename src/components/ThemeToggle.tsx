"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Choice = "light" | "dark" | "system";
const KEY = "theme";
const dark = () => window.matchMedia("(prefers-color-scheme: dark)");

/** Sets the theme on the page. "system" follows the computer or phone setting. */
function apply(choice: Choice) {
  const isDark = choice === "dark" || (choice === "system" && dark().matches);
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
}

function read(): Choice {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

const options: { value: Choice; label: string; path: string }[] = [
  { value: "light", label: "Light", path: "M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" },
  { value: "dark", label: "Dark", path: "M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z" },
  { value: "system", label: "System", path: "M3 5h18v11H3zM8 20h8M12 16v4" },
];

/**
 * Light, Dark or System. The choice is kept in this browser only. `floating` puts it at the bottom left of the
 * public pages; the dashboard shows it inside its sidebar instead.
 */
export function ThemeToggle({ floating = false }: { floating?: boolean }) {
  const path = usePathname();
  // Unknown until the browser has read the saved choice, so the server and browser render the same thing.
  const [choice, setChoice] = useState<Choice | null>(null);

  useEffect(() => setChoice(read()), []);

  // While on System, follow the device when it switches (for example at sunset), and keep other tabs in step.
  useEffect(() => {
    if (!choice) return;
    apply(choice);
    const media = dark();
    const onMedia = () => choice === "system" && apply("system");
    const onStorage = (e: StorageEvent) => e.key === KEY && setChoice(read());
    media.addEventListener("change", onMedia);
    window.addEventListener("storage", onStorage);
    return () => {
      media.removeEventListener("change", onMedia);
      window.removeEventListener("storage", onStorage);
    };
  }, [choice]);

  if (floating && path.startsWith("/admin")) return null;

  const pick = (value: Choice) => {
    try {
      if (value === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, value);
    } catch {
      // Private browsing: the choice still applies to this page.
    }
    setChoice(value);
  };

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={`flex items-center gap-0.5 rounded-full border border-line/70 p-1 ${floating ? "glass-panel fixed bottom-4 left-4 z-40 shadow-lg shadow-coal/10" : "bg-surface"}`}
    >
      {options.map((o) => {
        const on = choice === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={o.label}
            title={o.label}
            onClick={() => pick(o.value)}
            className={`grid size-9 place-items-center rounded-full transition-colors ${on ? "bg-ink text-ground" : "text-muted hover:text-ink"}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="size-[18px]">
              <path d={o.path} />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
