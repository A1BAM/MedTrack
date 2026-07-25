// Session auth for a single user, with no database round-trip:
// the cookie is `<expiry>.<hmac(secret, expiry)>`, so possession of a
// validly signed, unexpired token is the whole session state.
// Web Crypto only — this runs in middleware (edge) and in Workers.

export const SESSION_COOKIE = "medtrack_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const encoder = new TextEncoder();

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacHex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return toHex(new Uint8Array(signature));
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

export async function createSessionToken(
  secret: string
): Promise<{ token: string; expires: Date }> {
  const expiry = Date.now() + SESSION_TTL_MS;
  const signature = await hmacHex(secret, `session:${expiry}`);
  return { token: `${expiry}.${signature}`, expires: new Date(expiry) };
}

export async function verifySessionToken(
  token: string | undefined,
  secret: string | undefined
): Promise<boolean> {
  if (!token || !secret) return false;
  const dot = token.indexOf(".");
  if (dot < 0) return false;
  const expiry = Number(token.slice(0, dot));
  if (!Number.isFinite(expiry) || expiry < Date.now()) return false;
  const expected = await hmacHex(secret, `session:${expiry}`);
  return safeEqual(token.slice(dot + 1), expected);
}
