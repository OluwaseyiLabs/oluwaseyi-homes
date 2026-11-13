"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { moveInCost, specs, type Listing } from "@/lib/listings";
import { naira } from "@/lib/validation";
import { usePrefersReducedMotion } from "@/lib/scroll";

export function ListingCard({
  listing,
  index,
  onOpen,
}: {
  listing: Listing;
  index: number;
  onOpen: (l: Listing) => void;
}) {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(0);
  const timer = useRef<number | undefined>(undefined);
  const count = listing.images.length;

  const stop = () => {
    window.clearInterval(timer.current);
    timer.current = undefined;
    setShown(0);
  };
  const start = () => {
    if (reduced || count < 2 || timer.current) return;
    setShown(1);
    timer.current = window.setInterval(() => setShown((s) => (s + 1) % count), 1100);
  };
  useEffect(() => () => window.clearInterval(timer.current), []);

  return (
    <button
      type="button"
      onClick={() => onOpen(listing)}
      onMouseEnter={start}
      onMouseLeave={stop}
      onFocus={start}
      onBlur={stop}
      style={{ animationDelay: `${index * 70}ms` }}
      className="group animate-[rise_0.5s_ease-out_both] overflow-hidden rounded-3xl border border-line bg-surface text-left transition-transform duration-300 hover:-translate-y-0.5 motion-reduce:animate-none"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-green/10">
        {listing.images.map((src, i) => (
          <Image
            key={src}
            src={src}
            alt={i === 0 ? `${listing.title}, ${listing.location}` : ""}
            fill
            sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"
            className={`object-cover transition-opacity duration-500 ${
              i === shown ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}
        {listing.sample && (
          <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-coal">
            Sample
          </span>
        )}
        {listing.verified && (
          <span className="absolute right-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-[#14532d]">
            Owner verified
          </span>
        )}
      </div>
      <div className="p-5">
        <p className="text-xl font-extrabold tracking-tight">
          {listing.price}
          {listing.category === "Rent" && <span className="text-sm font-medium text-muted"> / year</span>}
        </p>
        <h3 className="mt-1 text-base font-semibold">{listing.title}</h3>
        <p className="mt-0.5 text-sm text-muted">{listing.location}</p>
        {specs(listing) && <p className="mt-3 text-sm text-muted">{specs(listing)}</p>}
        {listing.costs && (
          <p className="mt-3 flex items-baseline justify-between gap-3 border-t border-line pt-3 text-sm">
            <span className="text-muted">Total move-in cost</span>
            <span className="font-bold text-green tabular-nums">{naira(moveInCost(listing.costs).total)}</span>
          </p>
        )}
      </div>
    </button>
  );
}
