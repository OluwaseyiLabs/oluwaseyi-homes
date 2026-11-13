"use client";

import Image from "next/image";
import { useState } from "react";
import { PhotoViewer } from "@/components/PhotoViewer";

/** Thumbnails that open full size when clicked. */
export function PhotoGrid({ photos }: { photos: string[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((src, i) => (
          <button
            key={src}
            type="button"
            onClick={() => setOpen(i)}
            aria-label={`Enlarge photo ${i + 1}`}
            className="group relative aspect-[4/3] cursor-zoom-in overflow-hidden rounded-xl bg-green/10"
          >
            <Image src={src} alt="" fill sizes="(min-width: 1024px) 22vw, 45vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
          </button>
        ))}
      </div>
      {open !== null && <PhotoViewer photos={photos} start={open} onClose={() => setOpen(null)} />}
    </>
  );
}
