# MedTrack

A personal, single-user medication effectiveness tracker. Log doses from your
phone, check in on how well the medication is working (0–10), and see trends —
including how effectiveness rises and falls in the hours after a dose.

Built with Next.js (App Router) + TypeScript, Tailwind, Recharts, and Neon
Postgres via `@neondatabase/serverless`. Writes go through Server Actions — no
separate API layer. Deploys to Cloudflare Workers via
[`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare).

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

## Access protection

The whole app sits behind a password. Middleware checks a signed session
cookie on every request (pages, data, and Server Action writes alike) and
redirects to `/login` otherwise — including when the auth secrets aren't
configured yet, so it fails closed. Logging in with `APP_PASSWORD` sets an
HttpOnly cookie signed with `SESSION_SECRET` (HMAC-SHA256), valid for 30 days.

Pick a long, unique password — it is the only thing between the internet and
your health data. For an extra layer you can additionally put the Worker
behind [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/)
on a custom domain.

## 1. Create the database (Neon)

If you already have another project on Neon (e.g. another app's database),
keep MedTrack separate by creating a **new project**:

1. Go to [console.neon.tech](https://console.neon.tech) → **New Project**.
   Name it `medtrack`, pick the region closest to you (free plan allows
   multiple projects).
2. On the new project's dashboard, click **Connect**, make sure the
   `medtrack` project / `main` branch is selected, and copy the connection
   string (`postgres://…neon.tech/neondb?sslmode=require`). That string is
   your `DATABASE_URL`.

If your plan won't allow another project, the fallback is: open the existing
project → **Databases** → **New database** → `medtrack`, then copy the
connection string from **Connect** with the `medtrack` database selected.
The data stays fully separate either way (different database), it just shares
the project's compute.

## 2. Configure and run locally

```bash
cp .env.example .env.local
# edit .env.local:
#   DATABASE_URL                — the Neon connection string from step 1
#   APP_PASSWORD                — the password that unlocks the app
#   SESSION_SECRET              — run: openssl rand -hex 32
#   NEXT_PUBLIC_MED_NAME        — medication name shown in the UI
#   NEXT_PUBLIC_TYPICAL_DOSE_MG — your typical dose in mg

npm install
npm run migrate   # applies migrations/*.sql to DATABASE_URL (safe to re-run)
npm run dev
```

(Alternatively, paste `migrations/001_init.sql` into the Neon SQL editor.)

## 3. Deploy to Cloudflare Workers

```bash
npx wrangler login   # once
npm run deploy       # builds with OpenNext and deploys the Worker
```

Then set the three secrets on the deployed Worker (they live on Cloudflare,
not in the repo):

```bash
npx wrangler secret put DATABASE_URL
npx wrangler secret put APP_PASSWORD
npx wrangler secret put SESSION_SECRET
```

Dashboard alternative: **Workers & Pages → medtrack → Settings → Variables
and Secrets → Add → Secret**.

Notes:

- The `NEXT_PUBLIC_*` name/dose values are baked in at build time from
  `.env.local` on the machine running `npm run deploy` — they don't need to
  be Worker secrets.
- `npm run preview` runs the real Workers runtime locally; it reads secrets
  from a `.dev.vars` file (copy `.dev.vars.example`, it's gitignored).
- The migration runs from your machine (`npm run migrate`), not from the
  Worker.

## Data model

Two tables (see `migrations/001_init.sql`):

- `doses` — `taken_at`, `amount` (mg), optional `notes`.
- `check_ins` — `effectiveness` (0–10), optional `side_effects` and `notes`,
  and a nullable `dose_id` (`on delete cascade`). A new check-in is linked to
  the most recent dose within the last 16 hours at save time; the link can be
  overridden or removed from the Check-in form or from History.

The medication name and typical dose are env vars rather than a table, since
the app tracks exactly one medication for one person.
