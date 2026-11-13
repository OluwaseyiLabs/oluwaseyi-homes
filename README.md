# Oluwaseyi Homes & Properties

A property marketplace for Lagos: customers find rentals, sales and investments and are introduced directly to the
owner; owners list their properties and pay the listing fee online. The team runs everything from a dashboard.

**Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Supabase (database, login, file storage),
n8n (emails, 6-digit codes, follow-ups, schedule), Paystack (payments).

## Run it locally
1. `npm install`
2. Copy `.env.example` to `.env` and fill in your own values. **Never commit `.env`.**
3. Run the SQL files in `supabase/migrations/` in order (0001, 0002, ...) in the Supabase SQL editor.
4. Import `workflows/oluwaseyi-homes-and-properties.json` into n8n and connect your own credentials.
5. `npm run dev`, then open http://localhost:3000 (the dashboard is at `/admin`).

## Layout
- `src/app` pages and API routes, `src/components` UI, `src/lib` shared code
- `supabase/migrations` the database, including every security rule
- `workflows` the n8n workflow (sanitized) and notes on how the website talks to it
- `scripts` helpers; `sanitize-workflow.mjs` must be run on any n8n export before it is committed

Security: see [SECURITY.md](SECURITY.md).
