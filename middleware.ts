import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

// Fail closed: without a valid session cookie — including when
// SESSION_SECRET isn't configured yet — everything redirects to /login.
export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (await verifySessionToken(token, process.env.SESSION_SECRET)) {
    return NextResponse.next();
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  // Everything except the login page itself, build assets, and the favicon.
  matcher: ["/((?!login|_next|icon\\.svg|favicon\\.ico).*)"],
};
