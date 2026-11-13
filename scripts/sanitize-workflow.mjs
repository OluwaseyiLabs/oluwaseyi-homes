#!/usr/bin/env node
// Makes an n8n export safe to commit. Usage: node scripts/sanitize-workflow.mjs <export.json> [output.json]
//
// The real values are read from .env, so this file holds none of them:
//   TEAM_EMAIL, LEAD_SHEET_ID, NEXT_PUBLIC_WHATSAPP, LIVE_SITE_URL  ->  replaced with obvious placeholders
// It also removes what only means something on your own n8n: credential links, webhook ids and the error-workflow id.
// Never commit a raw export. Run this first; the workflow on n8n itself keeps its real values.
import { readFileSync, writeFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split("\n")
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim().replace(/^['"]|['"]$/g, "")]),
);

const swaps = [
  [env.TEAM_EMAIL, "team@your-domain.example"],
  [env.LEAD_SHEET_ID, "YOUR_GOOGLE_SHEET_ID"],
  [env.NEXT_PUBLIC_WHATSAPP, "234XXXXXXXXXX"],
  [env.LIVE_SITE_URL?.replace(/\/$/, ""), "https://your-domain.example"],
].filter(([from]) => from);

const [input, output = input] = process.argv.slice(2);
if (!input) {
  console.error("Usage: node scripts/sanitize-workflow.mjs <export.json> [output.json]");
  process.exit(1);
}

const clean = (value) => {
  if (typeof value === "string") return swaps.reduce((s, [from, to]) => s.split(from).join(to), value);
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clean(v)]));
  return value;
};

const wf = clean(JSON.parse(readFileSync(input, "utf8")));
for (const node of wf.nodes ?? []) {
  delete node.credentials;
  delete node.webhookId;
}
if (wf.settings) delete wf.settings.errorWorkflow;
for (const key of ["id", "versionId", "activeVersionId", "createdAt", "updatedAt"]) delete wf[key];

writeFileSync(output, JSON.stringify(wf, null, 2) + "\n");
console.log(`Wrote ${output}. Placeholders: ${swaps.length} private values replaced, credentials and webhook ids removed.`);
