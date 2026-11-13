import { Logo } from "./Logo";
import { getSiteContent } from "@/lib/data";
import { LEGAL_LABELS, LEGAL_SLUGS } from "@/lib/legal";

export async function Footer() {
  const { site, content } = await getSiteContent();
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <Logo className="text-lg" name={site.name} />
        <div className="flex flex-col gap-2 sm:items-end">
          <nav aria-label="Legal" className="flex flex-wrap gap-x-5 text-sm text-muted sm:justify-end">
            {LEGAL_SLUGS.map((s) => (
              <a key={s} href={`/legal/${s}`} className="inline-flex min-h-11 items-center underline-offset-4 hover:text-ink hover:underline">
                {s === "agreement" ? "Listing agreement" : LEGAL_LABELS[s]}
              </a>
            ))}
          </nav>
          <a href="/track" className="inline-flex min-h-11 items-center text-sm font-semibold text-green underline underline-offset-4">Track your enquiry</a>
          <p className="text-sm text-muted">
            &copy; {new Date().getFullYear()} {content.footerLine}
          </p>
        </div>
      </div>
    </footer>
  );
}
