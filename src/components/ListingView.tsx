"use client";

import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";
import { formatDetail, specs, type DetailField, type Listing } from "@/lib/listings";
import { propertyChatMessage } from "@/lib/messages";
import { propertyPath } from "@/lib/slug";
import { waLink } from "@/lib/site";
import { CostBreakdown } from "./CostBreakdown";
import { PhotoViewer } from "./PhotoViewer";
import { useSite } from "./SiteProvider";
import { MailIcon } from "./ButtonIcons";

/** The photos of a property: one large, thumbnails below, arrows, and a click to enlarge. Used by the pop-up and the property page. */
export function ListingGallery({ listing }: { listing: Listing }) {
  const [idx, setIdx] = useState(0);
  const [zoom, setZoom] = useState(false);
  const n = listing.images.length;
  const step = (d: number) => setIdx((i) => (i + d + n) % n);

  return (
    <div className="min-w-0 p-3 sm:p-4">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-green/10">
        {listing.images.map((src, i) => (
          <Image
            key={src}
            src={src}
            alt={i === idx ? `${listing.title}, photo ${i + 1} of ${n}` : ""}
            fill
            sizes="(min-width: 1024px) 45vw, 100vw"
            className={`object-cover transition-opacity duration-500 ${i === idx ? "opacity-100" : "opacity-0"}`}
          />
        ))}
        <button type="button" aria-label="Enlarge photo" onClick={() => setZoom(true)} className="absolute inset-0 cursor-zoom-in" />
        {n > 1 && (
          <>
            <button type="button" aria-label="Previous photo" onClick={() => step(-1)} className="absolute left-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-coal text-lg transition active:scale-95">←</button>
            <button type="button" aria-label="Next photo" onClick={() => step(1)} className="absolute right-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-coal text-lg transition active:scale-95">→</button>
          </>
        )}
      </div>
      <div className="mt-3 flex max-w-full gap-2 overflow-x-auto overscroll-x-contain pb-1">
        {listing.images.map((src, i) => (
          <button
            key={src}
            type="button"
            aria-label={`Show photo ${i + 1}`}
            aria-current={i === idx}
            onClick={() => setIdx(i)}
            className={`relative aspect-[4/3] w-20 shrink-0 overflow-hidden rounded-xl border-2 transition ${i === idx ? "border-green" : "border-transparent opacity-70 hover:opacity-100"}`}
          >
            <Image src={src} alt="" fill sizes="80px" className="object-cover" />
          </button>
        ))}
      </div>
      {zoom && <PhotoViewer photos={listing.images} start={idx} onClose={() => setZoom(false)} />}
    </div>
  );
}

/** The WhatsApp link to the company about this property, already opening with a message that names it. */
export function useChatLink(listing: Listing) {
  const { site } = useSite();
  return waLink(site.whatsapp, propertyChatMessage({ company: site.name, title: listing.title, location: listing.location, code: /^P-\d+$/.test(listing.id) ? listing.id : undefined }));
}

/** Everything a visitor reads about a property. `children` is what goes at the bottom: the enquiry buttons. */
export function ListingInfo({ listing, detailFields, children, heading = "h2" }: { listing: Listing; detailFields: DetailField[]; children?: ReactNode; heading?: "h1" | "h2" }) {
  const Title = heading;
  const shownDetails = detailFields.filter((f) => listing.details?.[f.id]);
  const facts = (
    [
      ["What the service charge covers", listing.serviceCovers],
      ["Parking", listing.parking],
      ["Security", listing.security],
      ["Inspection availability", listing.inspection],
    ] as [string, string | undefined][]
  ).filter(([, v]) => v);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <Title className="text-xl font-bold">{listing.title}</Title>
        {listing.verified && <span className="rounded-full bg-green/10 px-3 py-1 text-sm font-semibold text-green">Owner verified</span>}
      </div>
      <p className="mt-1 text-muted">{[listing.location, specs(listing)].filter(Boolean).join(" · ")}</p>
      <p className="mt-3 text-3xl font-extrabold tracking-tight">
        {listing.price}
        {listing.category === "Rent" && <span className="text-base font-medium text-muted"> / year</span>}
      </p>
      <p className="mt-4 leading-relaxed text-muted">{listing.description}</p>

      {listing.costs && (
        <CostBreakdown costs={listing.costs} />
      )}

      {(facts.length > 0 || listing.facilities?.length) && (
        <section className="mt-6 border-t border-line pt-6">
          {listing.facilities?.length ? (
            <>
              <h3 className="text-lg font-bold">Available facilities</h3>
              <ul className="mt-3 flex flex-wrap gap-2">
                {listing.facilities.map((f) => (
                  <li key={f} className="rounded-full border border-line px-3 py-1 text-sm">{f}</li>
                ))}
              </ul>
            </>
          ) : null}
          <dl className="mt-5 grid grid-cols-1 gap-4 text-sm">
            {facts.map(([label, value]) => (
              <div key={label}>
                <dt className="text-muted">{label}</dt>
                <dd className="mt-0.5 font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          {listing.video?.startsWith("https://") && (
            <a href={listing.video} target="_blank" rel="noreferrer" className="mt-5 inline-block text-sm font-semibold text-green underline underline-offset-4">
              Watch the video tour
            </a>
          )}
        </section>
      )}

      {shownDetails.length > 0 && (
        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-6 text-sm">
          {shownDetails.map((f) => (
            <div key={f.id}>
              <dt className="text-muted">{f.label}</dt>
              <dd className="mt-0.5 font-semibold">{formatDetail(f, listing.details![f.id])}</dd>
            </div>
          ))}
        </dl>
      )}

      {listing.verified && (
        <section className="mt-6 border-t border-line pt-6">
          <h3 className="flex items-center gap-2 text-lg font-bold">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="size-5 text-green">
              <path d="M12 3l8 3v6c0 4.5-3.2 7.9-8 9-4.8-1.1-8-4.5-8-9V6zM9 12l2 2 4-4" />
            </svg>
            Property verification
          </h3>
          <p className="mt-2 text-sm text-muted">Landlord identity and authority verified. Property physically inspected. Availability confirmed.</p>
        </section>
      )}
      {children}
    </>
  );
}

const shareBtn =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-ink/20 px-5 text-sm font-semibold transition hover:border-ink active:scale-[0.97]";

/** Share a property: on WhatsApp, copy the link, or the phone's own share sheet. */
export function ShareRow({ listing }: { listing: Listing }) {
  const { site } = useSite();
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    setUrl(`${window.location.origin}${propertyPath(listing)}`);
    setCanShare(typeof navigator.share === "function");
  }, [listing]);
  const text = `${listing.title}, ${listing.location} (${listing.price}${listing.category === "Rent" ? " a year" : ""}) on ${site.name}`;

  return (
    <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-line pt-6" aria-label="Share this property">
      <span className="mr-1 text-sm font-semibold">Share</span>
      <a id="share-whatsapp" href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`} target="_blank" rel="noreferrer" className={shareBtn}>
        WhatsApp
      </a>
      <button
        type="button"
        id="share-copy"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            window.prompt("Copy this link", url);
          }
        }}
        className={shareBtn}
      >
        {copied ? "Link copied" : "Copy link"}
      </button>
      {canShare && (
        <button type="button" onClick={() => navigator.share({ title: listing.title, text, url }).catch(() => {})} className={shareBtn}>
          More…
        </button>
      )}
    </div>
  );
}

/** The buttons on a property's own page: enquire (opens the home page enquiry form already filled in), WhatsApp, and share. */
export function PageActions({ listing }: { listing: Listing }) {
  const chat = useChatLink(listing);
  return (
    <>
      <div className="mt-8 grid grid-cols-1 gap-3">
        <a
          href={`/?enquire=${encodeURIComponent(listing.id)}#enquiry-form`}
          data-track="enquire_property"
          id="page-enquire"
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-green px-7 font-semibold text-white icon-btn hover:bg-green-deep"
        >
          <MailIcon />
          Enquire about this property
        </a>
        <a
          href={chat}
          data-track="whatsapp"
          className="inline-flex min-h-12 items-center justify-center rounded-full border border-ink/20 px-7 font-semibold transition hover:border-ink active:scale-[0.97]"
        >
          Chat on WhatsApp
        </a>
      </div>
      <ShareRow listing={listing} />
    </>
  );
}
