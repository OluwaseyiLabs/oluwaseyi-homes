// Cleaning of everything a visitor types. Runs on the server for every public form, whatever the browser sent.
// This site has no AI model reading customer text, but the same text goes into emails, a spreadsheet, n8n and
// the dashboard, so it is stripped of markup, hidden characters, template syntax, spreadsheet formulas and
// "instructions" aimed at a model or an automation.

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
// Zero-width, bidirectional-override and other invisible characters used to hide text.
const INVISIBLE = /[­͏؜ᅟᅠ឴឵᠎​-‏‪-‮⁠-⁯ㅤ︀-️﻿ﾠ]/g;

/** Phrases that try to give orders to an AI model or an automation instead of describing a property. */
const INSTRUCTIONS: RegExp[] = [
  /\b(ignore|disregard|forget|override)\b[^.\n]{0,40}\b(previous|prior|above|earlier|all|any|your|the)\b[^.\n]{0,30}\b(instructions?|prompts?|rules?|guidelines?|directions?)\b/i,
  /\b(system|developer|hidden)\s+(prompt|message|instructions?)\b/i,
  /\byou\s+are\s+now\b/i,
  /\b(act|behave|respond)\s+as\s+(an?\s+)?(ai|assistant|chatbot|model|admin|administrator|system)\b/i,
  /\b(reveal|print|show|leak)\b[^.\n]{0,30}\b(prompt|secrets?|api\s*keys?|passwords?|tokens?|credentials)\b/i,
  /\bjailbreak\b/i,
  /<\|[^|]*\|>/,
  /\[\/?(inst|system|assistant|user)\]/i,
  /^\s*(system|assistant)\s*:/im,
];

/** Cleans one value. Single-line by default; `multiline` keeps line breaks (at most two in a row). */
export function cleanText(value: unknown, max: number, multiline = false): string {
  if (typeof value !== "string") return "";
  let s = value.normalize("NFKC").replace(INVISIBLE, "").replace(CONTROL, "");
  s = s.replace(/\r\n?/g, "\n");
  if (!multiline) s = s.replace(/\n+/g, " ");
  return s
    .replace(/<[^>]*>/g, " ") // HTML tags
    .replace(/[<>]/g, "") // stray angle brackets
    .replace(/\{\{|\}\}|\$\{|\{%|%\}/g, "") // template and expression syntax (n8n, JS, Jinja)
    .replace(/`{3,}/g, "") // code fences
    .replace(/\b(javascript|vbscript|data)\s*:/gi, "") // script links
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^[\s=+\-@|]+(?=[^\s=+\-@|])/, (m) => (/^\s*\+\d/.test(m) ? m : "")) // spreadsheet formulas start with = + - @
    .trim()
    .slice(0, max);
}

/** A phone number keeps only digits and the usual separators. */
export const cleanPhone = (v: unknown) => (typeof v === "string" ? v.replace(/[^\d\s()+-]/g, "").trim().slice(0, 25) : "");

/** An email address in lower case without anything that could add a mail header. */
export const cleanEmail = (v: unknown) => (typeof v === "string" ? v.replace(/[\s,;<>"'\\\u0000-\u001F]/g, "").toLowerCase().slice(0, 200) : "");

/** True when the text reads like orders to a model or an automation. */
export const looksLikeInstructions = (s: string) => INSTRUCTIONS.some((r) => r.test(s));

export const REFUSED = "Please remove anything that looks like instructions or code from your message and try again.";
