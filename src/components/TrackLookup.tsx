"use client";

import { useActionState } from "react";
import { lookupEnquiry } from "@/app/track/actions";
import { Field, inputCls } from "./Field";
import { TrackView } from "./TrackView";

export function TrackLookup() {
  const [state, action, pending] = useActionState(lookupEnquiry, { error: "", progress: null });
  return (
    <>
      <form action={action} className="grid grid-cols-1 gap-5" noValidate>
        <Field label="Your reference (for example OHP-L-000012)" name="code" required>
          <input id="code" name="code" autoComplete="off" className={inputCls} />
        </Field>
        <Field label="The email you used" name="email" required>
          <input id="email" name="email" type="email" autoComplete="email" className={inputCls} />
        </Field>
        {state.error && <p id="track-error" role="alert" className="text-sm font-medium text-red-700">{state.error}</p>}
        <button disabled={pending} className="inline-flex min-h-12 items-center justify-center rounded-full bg-green px-8 font-semibold text-white transition hover:bg-green-deep active:scale-[0.97] disabled:opacity-60">
          {pending ? "Looking…" : "Show my enquiry"}
        </button>
      </form>
      {state.progress && (
        <div className="mt-8 border-t border-line pt-8">
          <TrackView progress={state.progress} />
        </div>
      )}
    </>
  );
}
