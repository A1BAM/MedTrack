// Per-request session checks for Server Components and Server Actions.
//
// Middleware already gates every route, but Next.js treats Server Actions as
// public POST endpoints and middleware has had bypass bugs before
// (CVE-2025-29927). Every page that reads the database and every action that
// writes to it calls requireSession() itself, so a matcher mistake or a
// framework bug doesn't expose the data on its own.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isValidSession, SESSION_COOKIE } from "./auth";

export async function hasSession(): Promise<boolean> {
  const cookieStore = await cookies();
  return isValidSession(cookieStore.get(SESSION_COOKIE)?.value);
}

// Redirects to /login when the request isn't authenticated. redirect() works
// by throwing, so call this *outside* any try/catch.
export async function requireSession(): Promise<void> {
  if (!(await hasSession())) {
    redirect("/login");
  }
}
