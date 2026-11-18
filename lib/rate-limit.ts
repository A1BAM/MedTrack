// Brute-force protection for the login form, backed by Postgres because
// Workers isolates share no memory: an in-process counter would reset on
// every cold start and never see requests landing on other isolates.
//
// Two limits apply, both counting attempts that haven't been cleared by a
// successful login:
//  - per client (IP address, or its /64 for IPv6): stops a single source
//    hammering the form;
//  - global: caps the total guess rate however many addresses an attacker
//    rotates through. While it's tripped nobody can log in fresh — sessions
//    that are already logged in keep working — which is the right trade for
//    a single-user app whose password is the only thing protecting it.
//
// The attempt is recorded *before* it is counted, so a burst of parallel
// requests can't all slip under the limit together.

import { headers } from "next/headers";
import { hmacHex } from "./auth";
import { db } from "./db";

export const CLIENT_MAX_ATTEMPTS = 10;
export const CLIENT_WINDOW_MINUTES = 15;
export const GLOBAL_MAX_ATTEMPTS = 50;
export const GLOBAL_WINDOW_MINUTES = 60;

// Expand an IPv6 address and keep its first four groups: one subscriber
// usually controls a whole /64, so per-address limits would be trivial to
// sidestep by rotating within it.
function ipv6Prefix64(address: string): string {
  const [head, tail = ""] = address.toLowerCase().split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const fill = address.includes("::")
    ? Array(Math.max(0, 8 - left.length - right.length)).fill("0")
    : [];
  return [...left, ...fill, ...right].slice(0, 4).join(":") + "::/64";
}

export async function clientKey(secret: string): Promise<string> {
  const h = await headers();
  // On Workers, Cloudflare sets cf-connecting-ip and overwrites any value a
  // client sends. x-forwarded-for is only a fallback for local `next start`.
  const raw =
    h.get("cf-connecting-ip") ??
    h.get("x-forwarded-for")?.split(",")[0] ??
    "unknown";
  const address = raw.trim();
  const bucket = address.includes(":") ? ipv6Prefix64(address) : address;
  // Keyed hash: the table never holds a raw IP address.
  return (await hmacHex(secret, `login-client|${bucket}`)).slice(0, 32);
}

export type RateLimitResult = { allowed: true } | { allowed: false };

// Records this attempt and reports whether it is within the limits.
export async function recordLoginAttempt(
  client: string
): Promise<RateLimitResult> {
  const sql = db();
  const [, , counts] = await sql.transaction([
    sql`delete from login_attempts where attempted_at < now() - interval '1 day'`,
    sql`insert into login_attempts (client) values (${client})`,
    sql`select
          count(*) filter (
            where client = ${client}
              and attempted_at > now() - make_interval(mins => ${CLIENT_WINDOW_MINUTES})
          )::int as client_recent,
          count(*)::int as global_recent
        from login_attempts
        where attempted_at > now() - make_interval(mins => ${GLOBAL_WINDOW_MINUTES})`,
  ]);
  const row = counts[0] ?? {};
  const allowed =
    Number(row.client_recent) <= CLIENT_MAX_ATTEMPTS &&
    Number(row.global_recent) <= GLOBAL_MAX_ATTEMPTS;
  return allowed ? { allowed: true } : { allowed: false };
}

// A correct password clears that client's history, so the owner's own
// typos don't accumulate against them.
export async function clearLoginAttempts(client: string): Promise<void> {
  await db()`delete from login_attempts where client = ${client}`;
}
