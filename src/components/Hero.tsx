import { HouseIcon, WhatsAppIcon } from "./ButtonIcons";
import { HeroImage, type HeroSlide } from "./HeroImage";
import { getPublishedListings, getSiteContent } from "@/lib/data";
import { photoUrl } from "@/lib/listings";
import { propertyPath } from "@/lib/slug";
import { waLink } from "@/lib/site";

export async function Hero() {
  const [{ site, content }, listings] = await Promise.all([getSiteContent(), getPublishedListings()]);
  // The hero photo first, then the cover photo of up to five properties: real ones before the samples.
  const featured = [...listings].sort((a, b) => Number(!!a.sample) - Number(!!b.sample)).filter((l) => l.images[0]).slice(0, 5);
  const all: HeroSlide[] = [
    { src: photoUrl(site.heroImage), alt: "A modern family home in Lagos at golden hour" },
    ...featured.map((l) => ({ src: l.images[0], alt: `${l.title}, ${l.location}`, href: propertyPath(l), label: `${l.category === "Rent" ? "For rent" : l.category === "Buy" ? "For sale" : "Investment"} · ${l.propertyType}`, title: l.title, location: l.location })),
  ];
  // The same photo never appears twice (a sample property can reuse the hero photo).
  const slides = all.filter((s, i) => all.findIndex((x) => x.src === s.src) === i);
  return (
    <div className="overflow-x-clip">
    <section
      id="top"
      className="mx-auto grid min-h-[calc(100svh-4rem)] max-w-6xl items-center gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-14"
    >
      <div className="parallax-text">
        <h1 className="text-[2.6rem] font-extrabold leading-[1.02] tracking-[-0.04em] sm:text-6xl">
          {content.heroHeading}
        </h1>
        <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">
          {content.heroText}
        </p>
        <div className="mt-9 flex flex-wrap gap-3">
          <a
            href="#properties"
            data-track="see_properties"
            className="inline-flex min-h-12 items-center rounded-full bg-green px-7 text-base font-semibold text-white icon-btn hover:bg-green-deep"
          >
            <HouseIcon />
            {content.heroButton}
          </a>
          <a
            data-track="whatsapp"
            href={waLink(site.whatsapp, `Hello ${site.name}, I have a property enquiry.`)}
            className="inline-flex min-h-12 items-center rounded-full border border-ink/20 px-7 text-base font-semibold icon-btn icon-btn-outline hover:border-ink"
          >
            <WhatsAppIcon />
            Chat on WhatsApp
          </a>
        </div>
      </div>
      <HeroImage slides={slides} />
    </section>
    </div>
  );
}
