import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ListingGallery, ListingInfo, PageActions } from "@/components/ListingView";
import { SiteProvider } from "@/components/SiteProvider";
import { getDetailFields, getPricing, getPublishedListings, getSiteContent } from "@/lib/data";
import { specs } from "@/lib/listings";
import { codeFromSlug, propertyPath, propertySlug } from "@/lib/slug";

export const revalidate = 300;
type Props = { params: Promise<{ slug: string }> };

async function find(slug: string) {
  const code = codeFromSlug(slug);
  return code ? (await getPublishedListings()).find((l) => l.id.toLowerCase() === code) : undefined;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [listing, { site }] = await Promise.all([params.then((p) => find(p.slug)), getSiteContent()]);
  if (!listing) return { title: "Property not found" };
  const rent = listing.category === "Rent";
  const summary = [`${listing.price}${rent ? " a year" : ""}`, specs(listing), listing.location].filter(Boolean).join(" · ");
  const title = `${listing.title} in ${listing.location} | ${site.name}`;
  const description = `${summary}. ${listing.description}`.slice(0, 200);
  return {
    title,
    description,
    alternates: { canonical: propertyPath(listing) },
    openGraph: { title, description, type: "website", siteName: site.name, url: propertyPath(listing), images: listing.images[0] ? [{ url: listing.images[0] }] : undefined },
    twitter: { card: "summary_large_image", title, description, images: listing.images[0] ? [listing.images[0]] : undefined },
  };
}

export default async function PropertyPage({ params }: Props) {
  const { slug } = await params;
  const listing = await find(slug);
  if (!listing) notFound();
  // An old or mistyped address leads to the right one.
  if (slug !== propertySlug(listing)) permanentRedirect(propertyPath(listing));

  const [siteContent, pricing, detailFields] = await Promise.all([getSiteContent(), getPricing(), getDetailFields()]);
  const rent = listing.category === "Rent";
  // Search engines read this to show the price and photos in results.
  const data = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: listing.title,
    description: listing.description,
    url: propertyPath(listing),
    image: listing.images,
    offers: { "@type": "Offer", priceCurrency: "NGN", price: Number(listing.price.replace(/\D/g, "")) || undefined, ...(rent ? { description: "Annual rent" } : {}) },
  };

  return (
    <SiteProvider value={{ ...siteContent, pricing }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />
      <Header name={siteContent.site.name} base="/" />
      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <Link href="/#properties" className="inline-flex min-h-11 items-center text-sm font-semibold text-green underline underline-offset-4">
          ← All properties
        </Link>
        <article className="mt-4 grid overflow-hidden rounded-3xl border border-line bg-ground lg:grid-cols-[1.3fr_1fr]">
          <div className="lg:sticky lg:top-20 lg:self-start">
            <ListingGallery listing={listing} />
          </div>
          <div className="flex flex-col p-6 sm:p-8">
            <ListingInfo listing={listing} detailFields={detailFields} heading="h1">
              <PageActions listing={listing} />
            </ListingInfo>
          </div>
        </article>
      </main>
      <Footer />
    </SiteProvider>
  );
}
