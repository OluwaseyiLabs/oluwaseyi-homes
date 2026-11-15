import "server-only";
import { randomBytes } from "node:crypto";
import { storeError } from "./error-store";

/** Letters and digits without look-alikes, so the ID can be read out over the phone. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/**
 * Logs the full error as one JSON line (in Vercel: Project → Logs, search the ID) and returns a short ID.
 * Show the person only `genericError(id)`; never the error itself.
 */
export function logError(where: string, err: unknown, context: Record<string, unknown> = {}): string {
  const bytes = randomBytes(6);
  const id = "ERR-" + Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
  const e = err instanceof Error ? err : new Error(typeof err === "string" ? err : JSON.stringify(err));
  console.error(JSON.stringify({ level: "error", id, where, message: e.message, stack: e.stack?.split("\n").slice(0, 6), context, at: new Date().toISOString() }));
  // Also kept for the team's error page. The stack is trimmed and the context holds identifiers only.
  storeError({ ref: id, place: where, message: e.message, detail: { stack: e.stack?.split("\n").slice(0, 6), context }, staged: context.staged === true });
  return id;
}

export const genericError = (id: string) => `Something went wrong on our side. Please try again, and if it keeps happening quote this ID when you contact us: ${id}`;

/** Logs and returns the message to show, in one step. */
export const failWith = (where: string, err: unknown, context?: Record<string, unknown>) => genericError(logError(where, err, context));

/** For the team dashboard: keeps the message that says what failed, adds an ID, and logs the full error under that ID. */
export function withId(where: string, err: unknown, message: string, context?: Record<string, unknown>) {
  return `${message} Reference: ${logError(where, err, context)}.`;
}
