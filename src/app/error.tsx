"use client";

/** What a visitor sees when a page crashes. The reference is the same one the team finds in the Errors page. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid grid-cols-1 min-h-svh place-items-center bg-panel px-5 py-12 text-ink">
      <div className="w-full max-w-lg rounded-3xl border border-line bg-surface p-6 text-center sm:p-10">
        <h1 className="text-2xl font-extrabold tracking-tight">Something went wrong on our side.</h1>
        <p className="mt-3 text-lg text-muted">Please try again. If it keeps happening, tell us this reference when you contact us.</p>
        {error.digest && <p className="mt-4 break-all rounded-xl bg-panel px-4 py-3 font-mono text-sm">{error.digest}</p>}
        <button type="button" onClick={reset} className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-green px-8 font-semibold text-white transition hover:bg-green-deep">
          Try again
        </button>
      </div>
    </main>
  );
}
