"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { restoreStarter, saveLegal } from "@/app/admin/(dashboard)/legal/actions";
import { Field, inputCls } from "@/components/Field";
import { LEGAL_LABELS, LEGAL_TOKENS, type LegalPage, type LegalSlug } from "@/lib/legal";
import { Card, PageHeader, btnGhost, btnPrimary } from "./ui";

type Page = LegalPage & { starterBody: string; starterTitle: string };
type Version = { slug: string; version: number; savedAt: string; savedBy: string };

const when = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });

export function LegalEditor({ pages, history }: { pages: Page[]; history: Version[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [slug, setSlug] = useState<LegalSlug>(pages[0].slug);
  const page = pages.find((p) => p.slug === slug)!;
  const [title, setTitle] = useState(page.title);
  const [body, setBody] = useState(page.body);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  // Follow the saved page when it changes (another tab, or after saving) or another page is chosen.
  useEffect(() => {
    setTitle(page.title);
    setBody(page.body);
  }, [page.slug, page.version, page.title, page.body]);

  const dirty = title !== page.title || body !== page.body;
  const run = (action: () => Promise<{ error: string | null }>, ok: string) =>
    start(async () => {
      setNote(null);
      const res = await action();
      setNote(res.error ? { ok: false, text: res.error } : { ok: true, text: ok });
      router.refresh();
    });
  const choose = (s: LegalSlug) => {
    if (dirty && !confirm("You have changes that are not saved. Leave them behind?")) return;
    setNote(null);
    setSlug(s);
  };
  const save = (e: FormEvent) => {
    e.preventDefault();
    run(() => saveLegal(slug, title, body), "Saved. The page on the website is updated.");
  };

  return (
    <>
      <PageHeader title="Legal pages" text="The privacy policy, terms, refund policy and listing agreement shown on the website. Changes go live as soon as you save, and every saved version is kept." />
      <p className="mb-4 rounded-xl bg-gold/20 p-4 text-sm">
        The starter wording is a plain-language draft, not legal advice. Have a Nigerian lawyer review it, then paste in their version here before you launch.
      </p>
      <div role="tablist" aria-label="Legal pages" className="mb-4 flex flex-wrap gap-2">
        {pages.map((p) => (
          <button
            key={p.slug}
            role="tab"
            type="button"
            aria-selected={p.slug === slug}
            onClick={() => choose(p.slug)}
            className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition ${p.slug === slug ? "border-green bg-green text-white" : "border-line bg-surface hover:border-green"}`}
          >
            {LEGAL_LABELS[p.slug]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <form onSubmit={save} noValidate className="grid grid-cols-1 gap-4">
            <Field label="Page title" name="legal-title" required>
              <input id="legal-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className={inputCls} />
            </Field>
            <Field label="Text" name="legal-body" required>
              <textarea id="legal-body" value={body} onChange={(e) => setBody(e.target.value)} rows={26} maxLength={60000} className={`${inputCls} min-h-[28rem] py-3 font-mono text-sm leading-6`} />
            </Field>
            {note && (
              <p role={note.ok ? "status" : "alert"} className={`rounded-xl p-4 text-sm font-medium ${note.ok ? "bg-green/10 text-green" : "bg-red-50 text-red-700"}`}>
                {note.text}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <button disabled={pending || !dirty} className={btnPrimary}>{pending ? "Saving…" : "Save and publish"}</button>
              <a href={`/legal/${slug}`} target="_blank" rel="noopener" className={btnGhost}>View the live page</a>
              {page.version > 0 && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => confirm("Go back to the starter wording? Your saved versions stay in the history.") && run(() => restoreStarter(slug), "The starter wording is back.")}
                  className={`${btnGhost} text-red-700`}
                >
                  Restore starter text
                </button>
              )}
            </div>
            <p className="text-sm text-muted">
              {page.version > 0 && page.updatedAt ? `Live: version ${page.version}, saved by ${page.updatedBy} on ${when.format(new Date(page.updatedAt))}.` : "Live: the starter wording. Nothing has been saved yet."}
            </p>
          </form>
        </Card>

        <div className="grid grid-cols-1 content-start gap-4">
          <Card>
            <h2 className="text-lg font-bold">How to write it</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              <li><code className="rounded bg-panel px-1.5">## Heading</code> for a section heading</li>
              <li><code className="rounded bg-panel px-1.5">### Heading</code> for a smaller heading</li>
              <li><code className="rounded bg-panel px-1.5">- item</code> for a bullet list</li>
              <li><code className="rounded bg-panel px-1.5">**bold**</code> for bold words</li>
              <li>A blank line starts a new paragraph.</li>
            </ul>
            <h3 className="mt-5 text-sm font-bold">Words that fill in by themselves</h3>
            <p className="mt-1 text-sm text-muted">They stay correct when you change the fees or the company name.</p>
            <ul className="mt-3 space-y-1.5 text-sm text-muted">
              {LEGAL_TOKENS.map(([t, m]) => (
                <li key={t}><code className="rounded bg-panel px-1.5">{t}</code> is {m}</li>
              ))}
            </ul>
          </Card>
          <Card>
            <h2 className="text-lg font-bold">Saved versions</h2>
            <p className="mt-1 text-sm text-muted">Kept permanently, so you can show what a page said on any day.</p>
            <ul className="mt-3 space-y-2 text-sm">
              {history.filter((h) => h.slug === slug).slice(0, 8).map((h) => (
                <li key={h.version} className="flex justify-between gap-3">
                  <span className="font-semibold">Version {h.version}</span>
                  <span className="text-right text-muted">{h.savedBy}, {when.format(new Date(h.savedAt))}</span>
                </li>
              ))}
              {!history.some((h) => h.slug === slug) && <li className="text-muted">Nothing saved yet.</li>}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
