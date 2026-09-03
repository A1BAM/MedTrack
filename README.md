# MedTrack

A personal, single-user medication tracker. Log doses from your phone, mark
the moment the medication peaks, and see trends — above all, how long it takes
to peak and whether that's drifting. It also carries a throwaway daily meal
checklist that wipes itself overnight.

Built with Next.js (App Router) + TypeScript, Tailwind, Recharts, and Neon
Postgres via `@neondatabase/serverless`. Writes go through Server Actions — no
separate API layer. Deploys to Cloudflare Workers via
[`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare).

## Screens

- **Log** (home) — greets you by the Eastern hour (morning / afternoon /
  evening / night), then one big button that logs a dose at the current time
  with your typical amount; expandable options for a different amount, a
  backdated time, or notes.
- **Peak** — one big button that records the peak at the current time, plus
  options for a different time, side effects, and notes. It shows how long
  after your dose the peak landed, and auto-links to the most recent dose
  taken in the 16 hours before it; you can pick a different dose or save it
  unlinked.
- **History** — doses with their peaks nested under them, grouped by day,
  each peak showing how long after the dose it came. Delete entries, or
  re-link/unlink a peak.
- **Trends** — time to peak over time, a distribution of how long it usually
  takes, and stat tiles, with 7d/30d/90d/all filters.
- **Meals** — the day's eating plan as a checklist, with calories left against
  the target, protein against its floor, and an "add something else" dialog for
  anything off-plan. It is the one screen that stores nothing: see below.

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

### Option A: git-connected (Workers Builds)

Connect the repo in the Cloudflare dashboard (**Workers & Pages → Create →
connect to Git**). The default settings work as-is:

- Build command: `npm run build` (this runs the full OpenNext build — it
  produces both the Next.js output and the `.open-next` Worker bundle)
- Deploy command: `npx wrangler deploy`

Then configure, under **Settings → Variables and Secrets** (runtime):

- `DATABASE_URL`, `APP_PASSWORD`, `SESSION_SECRET` — add each as **Secret**

and under the **build** environment variables (Settings → Build):

- `NEXT_PUBLIC_MED_NAME`, `NEXT_PUBLIC_TYPICAL_DOSE_MG`,
  `NEXT_PUBLIC_TYPICAL_DURATION_HOURS` — these are baked in during the
  build, so they must be visible to the build step. If unset, the app falls
  back to "My medication" / 10 mg / 4 h.

### Option B: from your machine

```bash
npx wrangler login   # once
npm run deploy       # builds with OpenNext and deploys the Worker
npx wrangler secret put DATABASE_URL
npx wrangler secret put APP_PASSWORD
npx wrangler secret put SESSION_SECRET
```

With this flow the `NEXT_PUBLIC_*` values are read from `.env.local` at
build time.

Notes:

- `npm run preview` runs the real Workers runtime locally; it reads secrets
  from a `.dev.vars` file (copy `.dev.vars.example`, it's gitignored).
- The migration runs from your machine (`npm run migrate`), not from the
  Worker.

## Data model

Two tables (see `migrations/`):

- `doses` — `taken_at`, `amount` (mg), optional `notes`.
- `peaks` — `peak_at` (when the peak happened), `recorded_at` (when it was
  logged), optional `side_effects` and `notes`, and a nullable `dose_id`
  (`on delete cascade`). A new peak is linked to the most recent dose taken
  in the 16 hours before it, resolved at save time; the link can be
  overridden or removed from the Peak form or from History.

Migrations apply in filename order and are safe to re-run. `002_peaks.sql`
replaced an earlier 0–10 effectiveness rating with `peak_at` and renamed
`check_ins` to `peaks`.

Meals are not in the database at all. The checklist is kept in the browser's
`localStorage` under a key carrying the current **Eastern** date
(`medtrack:meals:2026-09-03`), so a refresh keeps the day's checkmarks but
midnight Eastern starts an empty plan — the app simply reads a key that isn't
there. Keys for any other day are deleted on load, so nothing accumulates and
there is no meal history to look back at. The day is re-checked every 30
seconds and whenever the tab is refocused, so a page left open overnight
clears itself too. The zone is `America/New_York`, which follows Eastern
wall-clock time year-round (so it stays midnight through daylight saving),
and it applies regardless of the phone's own timezone.

The plan itself — target calories, protein floor, maintenance, the meal
sections, and the quick-add list — is plain data at the top of `lib/meals.ts`;
edit it there.

## Look and feel

One set of tokens in `app/globals.css` drives both themes: warm stone
neutrals, a single eucalyptus accent, and clay for the alarm state (going
over, deleting, errors). The values are oklch-derived and contrast-checked —
ink 13.5:1 on the page, ink-2 5.6:1, muted 4.5:1 on a card, accent 4.9:1.
Charts read the same variables, so dark mode swaps in one place.

Two typefaces, self-hosted at build time via `next/font`: **Newsreader** for
screen titles and every number the app reports (doses, hours to peak,
calories), **Instrument Sans** at 400/500 for everything else. Three CSS
classes carry those roles app-wide — `.screen-title`, `.eyebrow`, `.num`.

The mockups this came from are in `design/`: `build-artboards.mjs` generates
the `.dc.html` artboards from one shared token system, and `palette.mjs`
prints the palette with its contrast ratios.

The medication name, typical dose, and typical duration are env vars rather
than a table, since the app tracks exactly one medication for one person.
The duration is never stored against a dose or peak — it's used only as a
reference: the expected wear-off time on the Log screen, and the dashed
marker line on both trend charts.
