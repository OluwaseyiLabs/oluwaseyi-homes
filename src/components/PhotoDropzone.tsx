"use client";

import { useRef, useState, type ClipboardEvent, type DragEvent } from "react";

/**
 * Where photos are added: drag them onto the box, choose them from the device (or take one on a phone), or click the
 * box and paste a copied photo. It only collects the files; the page decides what to do with them.
 */
export function PhotoDropzone({
  inputId,
  onFiles,
  busy,
  remaining,
  max,
  describedBy,
}: {
  inputId: string;
  onFiles: (files: File[]) => void;
  busy: boolean;
  /** How many more photos can still be added. */
  remaining: number;
  max: number;
  describedBy?: string;
}) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const depth = useRef(0);
  const full = remaining <= 0;

  const take = (list: FileList | File[] | null | undefined) => {
    const files = Array.from(list ?? []);
    if (files.length && !busy) onFiles(files);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    depth.current = 0;
    setOver(false);
    take(e.dataTransfer?.files);
  };
  // dragenter/dragleave also fire for the box's own children, so they are counted to keep the highlight steady.
  const onEnter = (e: DragEvent) => {
    e.preventDefault();
    depth.current++;
    setOver(true);
  };
  const onLeave = () => {
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setOver(false);
  };
  const onPaste = (e: ClipboardEvent) => {
    const files = Array.from(e.clipboardData?.items ?? [])
      .filter((i) => i.kind === "file" && i.type.startsWith("image/"))
      .map((i) => i.getAsFile())
      .filter((f): f is File => !!f);
    if (files.length) {
      e.preventDefault();
      take(files);
    }
  };

  if (full) {
    return <p className="mt-3 rounded-xl bg-green/10 px-4 py-3 text-sm font-semibold text-green">All {max} photos added. Remove one to add another.</p>;
  }

  return (
    <div
      role="group"
      aria-label="Add photos"
      tabIndex={0}
      onDragEnter={onEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={onLeave}
      onDrop={onDrop}
      onPaste={onPaste}
      className={`mt-3 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center outline-none transition focus-visible:ring-2 focus-visible:ring-green/30 ${
        over ? "border-green bg-green/10" : "border-ink/25 bg-surface hover:border-green/60"
      }`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={`size-9 ${over ? "text-green" : "text-muted"}`}>
        <path d="M12 16V5m0 0L8 9m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
      </svg>
      <p className="text-base font-semibold">{over ? "Drop your photos here" : busy ? "Adding your photos…" : "Drag and drop photos here"}</p>
      {!over && (
        <>
          <p className="text-sm text-muted">or</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => input.current?.click()}
            className="inline-flex min-h-11 items-center rounded-full border border-ink/20 bg-surface px-5 text-sm font-semibold transition hover:border-green hover:text-green active:scale-[0.97] disabled:opacity-60"
          >
            Choose from your device
          </button>
          <p className="mt-1 text-xs text-muted">
            JPG or PNG. You can add {remaining} more. Copied a photo? Click this box and paste it.
          </p>
        </>
      )}
      <input
        ref={input}
        id={inputId}
        type="file"
        accept="image/*"
        multiple
        disabled={busy}
        onChange={(e) => {
          take(e.target.files);
          e.target.value = "";
        }}
        className="sr-only"
        tabIndex={-1}
        aria-describedby={describedBy}
      />
    </div>
  );
}
