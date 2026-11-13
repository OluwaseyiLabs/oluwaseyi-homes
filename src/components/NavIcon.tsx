/** Small line icons in front of the menu links, so each one can be found at a glance. */
const paths: Record<string, string> = {
  properties: "M3 11.2 12 4l9 7.2M5.5 9.5V20h13V9.5M10 20v-5.2h4V20",
  how: "M4 6h3M4 12h3M4 18h3M10 6h10M10 12h10M10 18h10",
  fees: "M3.5 12.6V4.5a1 1 0 0 1 1-1h8.1l8 8a1.4 1.4 0 0 1 0 2l-7 7a1.4 1.4 0 0 1-2 0zM8 8h.01",
  contact: "M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4.1A8 8 0 1 1 20 11.5z",
};

export type NavIconName = keyof typeof paths;

export function NavIcon({ name, className = "size-4" }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={`shrink-0 ${className}`}>
      <path d={paths[name]} />
    </svg>
  );
}
