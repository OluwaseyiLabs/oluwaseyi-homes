"use client";

import { useEffect, useRef, useState } from "react";
import { useSite } from "./SiteProvider";

/** The words stretch wider than their line as they land, so the section clips sideways to stop the page shifting. */
/** Plays each time the paragraph scrolls into view, and resets once it has fully left. */
export function Statement() {
  const words = useSite().content.statement.split(" ");
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Starts the moment any of it is on screen, so it is never seen half empty.
    const enter = new IntersectionObserver(([e]) => e.isIntersecting && setShown(true), { threshold: 0 });
    // Resets as soon as it has fully left the screen, so scrolling past it and coming back plays it again. It never
    // restarts while any part of it can still be seen.
    const leave = new IntersectionObserver(([e]) => !e.isIntersecting && setShown(false), { threshold: 0 });
    enter.observe(el);
    leave.observe(el);
    return () => {
      enter.disconnect();
      leave.disconnect();
    };
  }, []);

  return (
    <section ref={ref} aria-label="Our approach" className="flex min-h-[80svh] items-center overflow-x-clip">
      <p className="mx-auto max-w-5xl px-5 text-3xl font-extrabold leading-[1.12] tracking-[-0.03em] sm:px-8 sm:text-5xl lg:text-6xl">
        {words.map((w, i) => (
          <span
            key={i}
            style={{ animationDelay: `${Math.round(i * Math.min(45, 450 / words.length))}ms` }}
            className={`inline-block origin-left pr-[0.28em] ${
              shown
                ? "animate-[stretch-in_0.5s_cubic-bezier(0.2,0.9,0.3,1)_both] motion-reduce:animate-none"
                : "opacity-0 motion-reduce:opacity-100"
            }`}
          >
            {w}
          </span>
        ))}
      </p>
    </section>
  );
}
