/**
 * Next.js calls this for every error nobody caught: a page that failed to render, an API route or a form action that
 * crashed. It records them in the same error log as the ones the site catches itself, under the reference Next.js gives
 * (the "digest"), which is also what the visitor sees on the error page.
 */
export async function onRequestError(err: unknown, request: { path: string; method: string }, context: { routeType: string; routePath: string }) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { storeError } = await import("./lib/error-store");
  const e = err instanceof Error ? err : new Error(String(err));
  const ref = (err as { digest?: string })?.digest || "ERR-UNCAUGHT";
  const path = request.path.split(/[?#]/)[0].slice(0, 200);
  storeError({ ref, place: `${context.routeType}: ${context.routePath}`, message: e.message, detail: { stack: e.stack?.split("\n").slice(0, 6), context: { path, method: request.method } } });
}
