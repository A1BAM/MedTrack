// Session auth for a single user, with no database round-trip:
// the cookie is `<expiry>.<hmac(secret, v2|expiry|sha256(password))>`, so
// possession of a validly signed, unexpired token is the whole session state.
//
// Folding a fingerprint of APP_PASSWORD into the signature means changing the
// password (or SESSION_SECRET) revokes every outstanding session at once —
// the "log out everywhere" switch for a lost phone or a leaked cookie.
//
// Web Crypto only — this runs in middleware (edge) and in Workers.

export const SESSION_COOKIE = "medtrack_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Minimums enforced at runtime. Anything weaker fails closed: nobody can log
// in and every existing session is rejected until the secrets are fixed.
export const MIN_PASSWORD_LENGTH = 12;
export const MIN_SECRET_LENGTH = 32;

// The values shipped in .env.example / .dev.vars.example. They are public, so
// a deployment still using them is as good as unprotected.
const PLACEHOLDERS = new Set([
  "choose-a-long-password",
  "64-hex-chars-from-openssl-rand-hex-32",
]);

export type AuthConfig = { password: string; secret: string };

export type AuthConfigResult =
  | { ok: true; config: AuthConfig }
  | { ok: false; reason: string };

export function readAuthConfig(): AuthConfigResult {
  const password = process.env.APP_PASSWORD ?? "";
  const secret = process.env.SESSION_SECRET ?? "";
  if (!password || !secret) {
    return {
      ok: false,
      reason:
        "APP_PASSWORD and SESSION_SECRET are not configured on the server — see the README.",
    };
  }
  if (PLACEHOLDERS.has(password) || PLACEHOLDERS.has(secret)) {
    return {
      ok: false,
      reason:
        "APP_PASSWORD or SESSION_SECRET is still the example value from .env.example. Set real values — see the README.",
    };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      reason: `APP_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters. Set a longer one — see the README.`,
    };
  }
  if (secret.length < MIN_SECRET_LENGTH) {
    return {
      ok: false,
      reason: `SESSION_SECRET must be at least ${MIN_SECRET_LENGTH} characters (generate one with: openssl rand -hex 32).`,
    };
  }
  return { ok: true, config: { password, secret } };
}

const encoder = new TextEncoder();

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
}

export async function sha256Hex(data: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", encoder.encode(data)));
}

export async function hmacHex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(data)));
}

// Constant-time-ish equality: compare SHA-256 digests instead of the raw
// strings so neither length nor content position leaks through timing.
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const [da, db] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  const ua = new Uint8Array(da);
  const ub = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < ua.length; i++) diff |= ua[i] ^ ub[i];
  return diff === 0;
}

async function sign(config: AuthConfig, expiry: number): Promise<string> {
  const fingerprint = await sha256Hex(config.password);
  return hmacHex(config.secret, `session:v2|${expiry}|${fingerprint}`);
}

export async function createSessionToken(
  config: AuthConfig
): Promise<{ token: string; expires: Date }> {
  const expiry = Date.now() + SESSION_TTL_MS;
  return {
    token: `${expiry}.${await sign(config, expiry)}`,
    expires: new Date(expiry),
  };
}

export async function verifySessionToken(
  token: string | undefined,
  config: AuthConfig
): Promise<boolean> {
  if (!token) return false;
  const match = /^(\d{1,16})\.([0-9a-f]{64})$/.exec(token);
  if (!match) return false;
  const expiry = Number(match[1]);
  const now = Date.now();
  // Reject expired tokens, and ones claiming to outlive the TTL.
  if (expiry < now || expiry > now + SESSION_TTL_MS + 60_000) return false;
  return safeEqual(match[2], await sign(config, expiry));
}

// For middleware and the login page: one call that fails closed when the
// secrets are missing or too weak.
export async function isValidSession(
  token: string | undefined
): Promise<boolean> {
  const auth = readAuthConfig();
  return auth.ok && verifySessionToken(token, auth.config);
}
