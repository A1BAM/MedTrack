# MedTrack

A personal, single-user medication effectiveness tracker. Log doses from your
phone, check in on how well the medication is working (0–10), and see trends —
including how effectiveness rises and falls in the hours after a dose.

Built with Next.js (App Router) + TypeScript, Tailwind, Recharts, and Neon
Postgres via `@neondatabase/serverless`. Writes go through Server Actions — no
separate API layer.

## Screens

- **Log** (home) — one big button that logs a dose at the current time with
  your typical amount; expandable options for a different amount, a backdated
  time, or notes.
- **Check-in** — rate effectiveness 0–10, note side effects. The check-in
  auto-links to the most recent dose taken within the last 16 hours; you can
  pick a different dose or save it unlinked.
- **History** — doses with their check-ins nested under them, grouped by day.
  Delete entries, or re-link/unlink a check-in.
- **Trends** — effectiveness over time, average effectiveness by hours after
  dose (when it kicks in / wears off), and stat tiles, with 7d/30d/90d/all
  filters.

## Setup

1. Create a [Neon](https://neon.tech) project and copy its connection string.
2. Configure the environment:

   ```bash
   cp .env.example .env.local
   # then edit .env.local:
   #   DATABASE_URL             — your Neon connection string
   #   NEXT_PUBLIC_MED_NAME     — the medication name shown in the UI
   #   NEXT_PUBLIC_TYPICAL_DOSE_MG — your typical dose in mg
   ```

3. Install and create the tables:

   ```bash
   npm install
   npm run migrate   # applies migrations/*.sql to DATABASE_URL (safe to re-run)
   ```

   (Alternatively, paste `migrations/001_init.sql` into the Neon SQL editor.)

4. Run it:

   ```bash
   npm run dev
   ```

## Deploying to Vercel

1. Push this repo to GitHub and import it into Vercel.
2. In the Vercel project settings, add the same three environment variables
   (`DATABASE_URL`, `NEXT_PUBLIC_MED_NAME`, `NEXT_PUBLIC_TYPICAL_DOSE_MG`).
3. Deploy. Run the migration once against the same database (step 3 above)
   if you haven't already.

> **Note:** there is no authentication — anyone with the URL can read and
> write your data. Keep the URL private, or put the deployment behind
> protection (e.g. Vercel's deployment protection, Cloudflare Access, or
> similar) since this logs personal health information.

## Data model

Two tables (see `migrations/001_init.sql`):

- `doses` — `taken_at`, `amount` (mg), optional `notes`.
- `check_ins` — `effectiveness` (0–10), optional `side_effects` and `notes`,
  and a nullable `dose_id` (`on delete cascade`). A new check-in is linked to
  the most recent dose within the last 16 hours at save time; the link can be
  overridden or removed from the Check-in form or from History.

The medication name and typical dose are env vars rather than a table, since
the app tracks exactly one medication for one person.
