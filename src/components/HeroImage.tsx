"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { usePrefersReducedMotion } from "@/lib/scroll";

export interface HeroSlide {
  src: string;
  alt: string;
  /** Property slides link to the property's page and show a caption. The first slide (the hero photo) has neither. */
  href?: string;
  label?: string;
  title?: string;
  location?: string;
}

const INTERVAL = 5200;

/**
 * The hero photo slides in from the right, then becomes a slideshow: it changes by itself; moving the mouse onto it
 * changes the photo straight away and holds it while the pointer stays; it and can be swiped or stepped with the dots and arrow keys. Everything that moves is a transform or an opacity, so it stays on the GPU.
 */
export function HeroImage({ slides }: { slides: HeroSlide[] }) {
  const reduced = usePrefersReducedMotion();
  const frame = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  // Slides are only fetched once they are the current or the next one.
  const [seen, setSeen] = useState<Set<number>>(new Set([0, 1]));
  const n = slides.length;

  const go = useCallback(
    (to: number) => {
      const next = ((to % n) + n) % n;
      setIndex(next);
      setSeen((s) => new Set(s).add(next).add((next + 1) % n));
    },
    [n],
  );

  // Show the frame as soon as the first photo is ready, and never leave it hidden if the load event is missed.
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 2000);
    return () => clearTimeout(t);
  }, []);

  // Changes slide by itself. Stops for reduced motion, while paused, and while the tab is hidden.
  useEffect(() => {
    if (n < 2 || reduced || paused || !ready) return;
    const id = setInterval(() => !document.hidden && go(index + 1), INTERVAL);
    return () => clearInterval(id);
  }, [n, reduced, paused, ready, index, go]);

  // Moving the mouse onto the photo changes it at once. A short cooldown stops it flickering if the pointer jitters on the edge.
  const lastHover = useRef(0);
  const enter = (e: PointerEvent<HTMLDivElement>) => {
    setPaused(true);
    if (e.pointerType !== "mouse" || n < 2) return;
    const now = Date.now();
    if (now - lastHover.current < 700) return;
    lastHover.current = now;
    go(index + 1);
  };
  const leave = () => setPaused(false);

  // Swipe on touch screens.
  const start = useRef<number | null>(null);
  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch") start.current = e.clientX;
  };
  const up = (e: PointerEvent<HTMLDivElement>) => {
    if (start.current === null) return;
    const dx = e.clientX - start.current;
    start.current = null;
    if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
  };

  const current = slides[index];

  return (
    <div
      ref={frame}
      role="group"
      aria-roledescription="carousel"
      aria-label="Featured properties"
      onPointerEnter={enter}
      onPointerLeave={leave}
      onPointerDown={down}
      onPointerUp={up}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(index + 1);
        if (e.key === "ArrowLeft") go(index - 1);
      }}
      className={`hero-frame group relative isolate [contain:paint] aspect-[4/5] touch-pan-y overflow-hidden rounded-3xl bg-green/10 lg:aspect-[5/6] ${
        ready
          ? "animate-[slide-in-right_1.25s_cubic-bezier(0.22,1,0.36,1)_both] motion-reduce:animate-none"
          : "opacity-0 motion-reduce:opacity-100"
      }`}
    >
      <div className="parallax-photo absolute inset-0" style={{ scale: "1.12" }}>
        <div className="absolute inset-0">
          {slides.map((s, i) =>
            seen.has(i) ? (
              <div key={`${i}-${s.src}`} aria-hidden={i !== index} className={`absolute inset-0 transform-gpu transition-opacity duration-[1100ms] ease-in-out [backface-visibility:hidden] ${i === index ? "opacity-100" : "opacity-0"}`}>
                <Image
                  src={s.src}
                  alt={i === index ? s.alt : ""}
                  fill
                  priority={i === 0}
                  sizes="(min-width: 1024px) 45vw, 100vw"
                  onLoad={i === 0 ? () => setReady(true) : undefined}
                  className={`object-cover ${i === index && !reduced ? "hero-kenburns" : ""}`}
                />
              </div>
            ) : null,
          )}
        </div>
      </div>

      {/* Caption for property slides: links to the property. */}
      {current.href && (
        <Link
          href={current.href}
          key={`${index}-${current.src}`}
          className="hero-caption absolute inset-x-3 bottom-12 z-10 rounded-2xl bg-coal/55 p-4 text-white backdrop-blur-sm transition hover:bg-coal/70 sm:inset-x-4 sm:bottom-14"
        >
          <span className="text-xs font-semibold uppercase tracking-wider text-white/80">{current.label}</span>
          <span className="mt-0.5 line-clamp-1 block text-lg font-extrabold tracking-tight">{current.title}</span>
          <span className="flex items-center justify-between gap-3 text-sm text-white/85">
            <span className="line-clamp-1">{current.location}</span>
            <span className="shrink-0 font-semibold">View property →</span>
          </span>
        </Link>
      )}

      {n > 1 && (
        <>
          <div className="absolute inset-x-0 bottom-3 z-20 flex justify-center gap-2 sm:bottom-4">
            {slides.map((s, i) => (
              <button
                key={`${i}-${s.src}`}
                type="button"
                aria-label={`Show photo ${i + 1} of ${n}`}
                aria-current={i === index}
                onClick={() => go(i)}
                className="grid grid-cols-1 h-6 place-items-center px-1"
              >
                <span className={`block h-1.5 rounded-full bg-white transition-all duration-300 ${i === index ? "w-6 opacity-100" : "w-1.5 opacity-55"}`} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
