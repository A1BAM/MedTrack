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
  It also carries an **estimated level** curve for the day: a one-compartment
  pharmacokinetic model (`lib/pk.ts`) summing every dose still on board, drawn
  solid up to now and dashed for the projection ahead. Hold and drag across it
  to read any time of day. The shape comes from two numbers,
  `NEXT_PUBLIC_HALF_LIFE_HOURS` and `NEXT_PUBLIC_TIME_TO_PEAK_HOURS`
  (defaults 3 h and 1.5 h — typical immediate-release figures); the absorption
  rate is solved from the time-to-peak rather than guessed. It is a
  population-average estimate, not a measurement — real clearance varies
  several-fold between people.
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

The whole app sits behind a password. Logging in with `APP_PASSWORD` sets an
HttpOnly cookie signed with `SESSION_SECRET` (HMAC-SHA256), valid for 30 days.
The session is checked in two places:

- **Middleware** checks the cookie on every request and redirects to `/login`
  otherwise.
- **Every data page and every Server Action** checks it again itself
  (`lib/session.ts`). A middleware mistake or a framework bypass bug can't
  expose or delete data on its own.

It **fails closed**. Nobody can log in, and every existing session is
rejected, while any of these is true:

- `APP_PASSWORD` or `SESSION_SECRET` is missing.
- Either is still the example value from `.env.example`.
- `APP_PASSWORD` is shorter than 12 characters.
- `SESSION_SECRET` is shorter than 32 characters.

The login page says which one is wrong. Generate the secret with
`openssl rand -hex 32`.

**Brute-force protection.** Login attempts are recorded in the
`login_attempts` table (`migrations/003_login_attempts.sql`), keyed by a
salted hash of the client's IP, never the raw address. Two limits apply:

| Limit | What it stops | When it's hit |
| --- | --- | --- |
| 10 attempts per IP (per /64 for IPv6) per 15 minutes | One source hammering the form | That IP is locked out for the rest of the window |
| 50 attempts across all IPs per hour | Attackers rotating through many addresses | Nobody can log in fresh until it drains |

Notes on the limits:

- Already logged-in sessions keep working through either lockout.
- A successful login clears that IP's count.
- If the table is missing or the database is unreachable, login is refused
  rather than unthrottled. **Run `npm run migrate` before deploying this
  version.**

**Logging out everywhere.** A session cookie is self-contained, so logging
out only removes it from that browser. To revoke every session, including a
lost phone or a leaked cookie, change `APP_PASSWORD` (or rotate
`SESSION_SECRET`). Sessions are bound to both, so all of them stop working
immediately.

**Other hardening:**

- The login page and tab title don't name the medication, and search
  engines are told not to index the site.
- Database error details stay in the Worker logs instead of reaching the
  browser.
- Server Actions validate their input at runtime.
- Every response carries security headers: HSTS, `frame-ancestors 'none'` /
  `X-Frame-Options`, `nosniff`, `Referrer-Policy: no-referrer`, and a
  restrictive `Permissions-Policy`. The `X-Powered-By` header is removed.
- `preview_urls` is off in `wrangler.jsonc`, so old deployed versions don't
  stay reachable.

Pick a long, unique password — it is the only thing between the internet and
your health data. For an extra layer you can additionally put the Worker
behind [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/)
on a custom domain. If you do, also set `"workers_dev": false` in
`wrangler.jsonc`, or the `*.workers.dev` URL remains a way around Access.

Anything bundled for the browser is served from `/_next/static` without
login. Server-rendered data is not in those files, but client-side code is,
such as the meal plan in `lib/meals.ts` and the dose-curve settings. Don't
put anything there you'd mind being public.

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
#   APP_PASSWORD                — the password that unlocks the app (12+ chars)
#   SESSION_SECRET              — run: openssl rand -hex 32 (32+ chars)
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
  Worker. Run it before deploying a version that adds a migration: login
  refuses to work until `login_attempts` exists.

## Data model

Two data tables, plus `login_attempts` for brute-force protection
(see `migrations/`):

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
