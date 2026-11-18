-- 003_login_attempts.sql
-- Brute-force protection for /login. Every login attempt is recorded here
-- for a short while; lib/rate-limit.ts refuses new attempts once a client, or
-- the app as a whole, has made too many recently. Rows are pruned after a day.
-- Safe to run more than once.

create table if not exists login_attempts (
  id            bigserial primary key,
  client        text not null,  -- HMAC of the client's IP (/64 for IPv6), never the raw address
  attempted_at  timestamptz not null default now()
);

create index if not exists login_attempts_attempted_at_idx
  on login_attempts (attempted_at desc);
create index if not exists login_attempts_client_idx
  on login_attempts (client, attempted_at desc);
