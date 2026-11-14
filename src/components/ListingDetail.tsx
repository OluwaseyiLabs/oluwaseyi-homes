"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { DetailField, Listing } from "@/lib/listings";
import { propertyPath } from "@/lib/slug";
import { presetEnquiry } from "@/lib/scroll";
import { ListingGallery, ListingInfo, ShareRow, useChatLink } from "./ListingView";
import { MailIcon } from "./ButtonIcons";

export function ListingDetail({
  listing,
  detailFields,
  onClose,
  preview = false,
}: {
  listing: Listing;
  detailFields: DetailField[];
  onClose: () => void;
  /** Shown from the dashboard: looks exactly like the website, but the enquiry buttons do nothing. */
  preview?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const chat = useChatLink(listing);

  useEffect(() => {
    ref.current?.showModal();
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, []);

  const enquire = () => {
    ref.current?.close();
    window.setTimeout(
      () =>
        presetEnquiry({
          enquiryType: listing.category,
          propertyType: listing.propertyType,
          location: listing.location,
          budget: listing.price,
          facilities: (listing.facilities ?? []).join(","),
          listingId: listing.id,
          note: `Interested in: ${listing.title}, ${listing.location} (${listing.price}${listing.category === "Rent" ? " / year" : ""}).`,
        }),
      80,
    );
  };

  return (
    <dialog
      ref={ref}
      // The enlarged photo is a dialog inside this one; ignore its close event.
      onClose={(e) => e.target === e.currentTarget && onClose()}
      onClick={(e) => e.target === e.currentTarget && ref.current?.close()}
      aria-label={listing.title}
      className="m-auto max-h-[92svh] w-[min(64rem,calc(100%-1.5rem))] overflow-y-auto glass-panel glass-scrim rounded-3xl border border-white/60 p-0 text-ink"
    >
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <ListingGallery listing={listing} />
        <div className="flex min-w-0 flex-col p-6 sm:p-8">
          <button
            type="button"
            aria-label="Close"
            onClick={() => ref.current?.close()}
            className="-mr-2 -mt-2 mb-2 grid size-11 place-items-center self-end rounded-full text-2xl transition hover:bg-line active:scale-95"
          >
            ×
          </button>
          <ListingInfo listing={listing} detailFields={detailFields}>
            <div className="mt-8 grid grid-cols-1 gap-3">
              <button
                type="button"
                data-track={preview ? undefined : "enquire_property"}
                onClick={preview ? undefined : enquire}
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-green px-7 font-semibold text-white icon-btn hover:bg-green-deep"
              >
                <MailIcon />
                Enquire about this property
              </button>
              <a
                data-track={preview ? undefined : "whatsapp"}
                href={preview ? undefined : chat}
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-ink/20 px-7 font-semibold transition hover:border-ink active:scale-[0.97]"
              >
                Chat on WhatsApp
              </a>
              {!preview && (
                <Link href={propertyPath(listing)} id="open-page" className="inline-flex min-h-11 items-center justify-center text-sm font-semibold text-green underline underline-offset-4">
                  Open the full page
                </Link>
              )}
            </div>
            {!preview && <ShareRow listing={listing} />}
          </ListingInfo>
        </div>
      </div>
    </dialog>
  );
}
