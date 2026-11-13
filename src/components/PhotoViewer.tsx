"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

/** Full-size photo viewer with arrows. Opens above whatever is on screen, including another dialog. */
export function PhotoViewer({ photos, start, onClose }: { photos: string[]; start: number; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [i, setI] = useState(start);
  const n = photos.length;
  const step = (d: number) => setI((x) => (x + d + n) % n);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const arrow =
    "absolute top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-xl text-coal transition active:scale-95";

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && ref.current?.close()}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") step(-1);
        if (e.key === "ArrowRight") step(1);
      }}
      aria-label={`Photo ${i + 1} of ${n}`}
      className="m-auto h-[92svh] w-[min(80rem,calc(100%-1.5rem))] max-w-none overflow-hidden glass-scrim rounded-2xl bg-coal p-0"
    >
      <div className="relative size-full">
        <Image src={photos[i]} alt={`Photo ${i + 1} of ${n}`} fill sizes="100vw" className="object-contain" />
        <button type="button" aria-label="Close" onClick={() => ref.current?.close()} className="absolute right-3 top-3 grid size-12 place-items-center rounded-full bg-white/95 text-2xl text-coal transition active:scale-95">
          ×
        </button>
        {n > 1 && (
          <>
            <button type="button" aria-label="Previous photo" onClick={() => step(-1)} className={`${arrow} left-3`}>←</button>
            <button type="button" aria-label="Next photo" onClick={() => step(1)} className={`${arrow} right-3`}>→</button>
            <p className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white/95 px-3 py-1 text-sm font-semibold text-coal">
              {i + 1} of {n}
            </p>
          </>
        )}
      </div>
    </dialog>
  );
}
