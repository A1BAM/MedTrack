import { NextResponse, type NextRequest } from "next/server";
import { isValidSession, SESSION_COOKIE } from "@/lib/auth";

// Fail closed: without a valid session cookie — including when
// SESSION_SECRET / APP_PASSWORD aren't configured, or are too weak —
// everything redirects to /login.
//
// This is the first gate, not the only one: pages and Server Actions also
// check the session themselves (lib/session.ts).
export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (await isValidSession(token)) {
    return NextResponse.next();
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  // Everything except exactly /login, build assets under /_next/, and the
  // icons. Anchored, so a future route like /login-history or /_nextfoo is
  // still protected.
  matcher: ["/((?!login$|_next/|icon\\.svg$|favicon\\.ico$).*)"],
};
