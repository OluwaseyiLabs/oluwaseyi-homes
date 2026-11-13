import { site as defaults } from "@/lib/site";

/** The company name as a wordmark. Pass `name` from the database; it falls back to the built-in name. */
export function Logo({ className = "", name = defaults.name, href = "#top" }: { className?: string; name?: string; href?: string }) {
  return (
    <a
      href={href}
      aria-label={`${name}, home`}
      className={`inline-block py-3 font-extrabold leading-none tracking-[-0.04em] text-ink ${className}`}
    >
      {name}.
    </a>
  );
}
