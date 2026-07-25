"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSessionToken, safeEqual, SESSION_COOKIE } from "./auth";
import type { ActionResult } from "./types";

export async function login(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const password = String(formData.get("password") ?? "");
  const expected = process.env.APP_PASSWORD;
  const secret = process.env.SESSION_SECRET;

  if (!expected || !secret) {
    return {
      ok: false,
      message:
        "APP_PASSWORD and SESSION_SECRET are not configured on the server — see the README.",
    };
  }
  if (!password || !(await safeEqual(password, expected))) {
    // Small fixed delay to make brute-forcing slower.
    await new Promise((resolve) => setTimeout(resolve, 400));
    return { ok: false, message: "Wrong password." };
  }

  const { token, expires } = await createSessionToken(secret);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires,
    path: "/",
  });
  redirect("/");
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect("/login");
}
