import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer } from "@/components/Footer";
import { LegalBody } from "@/components/LegalBody";
import { Logo } from "@/components/Logo";
import { getLegalPage, getPricing, getSiteContent } from "@/lib/data";
import { LEGAL_LABELS, LEGAL_SLUGS, fillLegal, isLegalSlug } from "@/lib/legal";

export const revalidate = 300;

export function generateStaticParams() {
  return LEGAL_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return isLegalSlug(slug) ? { title: `${LEGAL_LABELS[slug]} | ${(await getSiteContent()).site.name}` } : {};
}

const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" });

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isLegalSlug(slug)) notFound();
  const [page, pricing, { site }] = await Promise.all([getLegalPage(slug), getPricing(), getSiteContent()]);
  return (
    <>
      <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
        <Logo name={site.name} href="/" />
        <h1 className="mt-10 text-4xl font-extrabold tracking-[-0.03em] text-ink sm:text-5xl">{page.title}</h1>
        {page.updatedAt && <p className="mt-3 text-sm text-muted">Last updated {date.format(new Date(page.updatedAt))}</p>}
        <div className="mt-6">
          <LegalBody text={fillLegal(page.body, pricing, site)} />
        </div>
        <nav aria-label="Other legal pages" className="mt-14 flex flex-wrap gap-x-6 border-t border-line pt-6 text-sm font-semibold">
          {LEGAL_SLUGS.filter((s) => s !== slug).map((s) => (
            <Link key={s} href={`/legal/${s}`} className="inline-flex min-h-11 items-center text-green underline underline-offset-4">{LEGAL_LABELS[s]}</Link>
          ))}
          <Link href="/" className="inline-flex min-h-11 items-center text-green underline underline-offset-4">Back to the website</Link>
        </nav>
      </main>
      <Footer />
    </>
  );
}
