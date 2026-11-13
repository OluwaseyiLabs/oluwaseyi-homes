# CLAUDE.md

Turn n8n workflows into deployed web apps: **n8n workflow → Next.js app (local) → GitHub → Vercel**.
This app also uses **Supabase** (Postgres, login, file storage) for its records. n8n handles emails, codes, follow-ups and the schedule; the database enforces the rules that must never be bypassed (contact release, history, invoices).
One repo per app. This folder is the template for each.

## Tools & Skills
- **n8n MCP**: look up nodes, configs and templates; read, build and edit workflows on my self-hosted n8n instance.
- **GitHub MCP**: create the repo and push changes.
- **Skills** (installed globally in `~/.claude/skills`): `n8n` skills for workflow work; `design-taste-frontend` for ALL UI work.

## Process (in order)
1. **Workflow**: inspect the workflow via n8n MCP. Make sure it takes clean input and returns clean output (contract below). Export the JSON to `workflows/` and document the contract.
2. **Front-end**: build with Next.js (App Router) + React + TypeScript + Tailwind CSS. Run locally with `npm run dev` and iterate until it works end to end.
3. **GitHub**: once the app is optimized, init the repo, commit, push.
4. **Vercel**: import the GitHub repo, add env vars, and let it auto-deploy on every push to `main`. After that, any workflow or UI change = edit, push, done.

## Workflow Triggers
**One workflow per app.** Everything this app needs in n8n lives in a single workflow, even when it has several triggers (webhooks, schedules, and so on). Add new triggers and branches to that workflow; never create a second one.

Various triggers: use whatever trigger type fits the use case (Webhook, Form, Chat, Schedule, app/event triggers, etc.). Don't force a Webhook where another trigger is the better fit.

When the web app needs to call or get a result from a workflow, that workflow must follow this contract:
- Expose a **Webhook** node, `POST`, JSON body (a workflow can have this alongside its other triggers).
- First step after the trigger validates required fields; reject bad input with a clear error.
- Last step is **Respond to Webhook** returning JSON: `{ "success": boolean, "data": any, "error": string | null }`.
- Every error path (error branch / Error Trigger) must also respond with that shape. A workflow must never hang or return an empty response.

For workflows triggered by something else (schedule, event), the app reads results another way (e.g. a status/results webhook or data store). Decide per workflow.

Record each workflow's trigger type and request/response shape in `workflows/<name>.md`. Update it whenever the I/O changes.

## Integration Rule
Browser → Next.js API route (`src/app/api/...`) → n8n webhook. The browser never calls n8n directly, so webhook URLs and keys stay server-side.

## Secrets
- ALL keys live in `.env` (gitignored; `.env.local` for the Next.js app). Commit `.env.example` with names only.
- MCP servers read keys from `.env` via `scripts/` (see `.mcp.json`). Never put a key in `.mcp.json`, code, docs, chat output or commits, and never print or echo `.env` contents.
- Vars: `N8N_API_URL`, `N8N_API_KEY`, `GITHUB_PERSONAL_ACCESS_TOKEN`; app vars like `N8N_WEBHOOK_URL`, `N8N_WEBHOOK_SECRET`, `N8N_LISTING_WEBHOOK_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`, `PAYSTACK_SECRET_KEY`, `SITE_URL`. Mirror app vars in Vercel project settings.
- Private business details (WhatsApp number, lead-sheet link and ID, team email, live domain) live in `.env` as `NEXT_PUBLIC_WHATSAPP`, `LEAD_SHEET_URL`, `LEAD_SHEET_ID`, `TEAM_EMAIL`, `LIVE_SITE_URL`. Never write them into code, docs or examples; use `ada@example.com`-style fakes.
- n8n exports in `workflows/` must go through `node scripts/sanitize-workflow.mjs <file>` before committing: it blanks those values and strips credential and webhook ids. The workflow on n8n keeps its real values.
- Database changes are numbered files in `supabase/migrations/`, run in order in the Supabase SQL editor.
- If a key is needed, read it from `.env`; if it's missing, ask me to add it there.
- My n8n is self-hosted: Vercel can only call it if it is publicly reachable (not `localhost`). Check this before deploying.

## Safety: ask first
Confirm with me before: pushing to GitHub, deploying, or modifying/activating/deleting workflows on the live n8n instance.

## Styling
Tailwind CSS only. No other CSS frameworks or component-library styling unless I ask.

## File Structure
Propose structure: before scaffolding any new app, suggest a clean, scalable folder structure for that project and get my OK. Use this as the starting baseline and adapt it to the app:
```
workflows/          n8n JSON exports + <name>.md contract notes
src/app/            pages
src/app/api/        routes that proxy to n8n
src/components/     UI components
src/lib/            n8n client helper
scripts/            MCP launchers that load keys from .env
.env.example
.mcp.json
CLAUDE.md
```
Keep it lean and scalable: no unused files, no duplicate components, small focused modules.
