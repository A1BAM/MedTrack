"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  createSessionToken,
  readAuthConfig,
  safeEqual,
  SESSION_COOKIE,
} from "./auth";
import {
  clearLoginAttempts,
  clientKey,
  recordLoginAttempt,
} from "./rate-limit";
import type { ActionResult } from "./types";

const MAX_PASSWORD_INPUT = 1024;

export async function login(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const auth = readAuthConfig();
  if (!auth.ok) {
    return { ok: false, message: auth.reason };
  }
  const { config } = auth;

  const raw = formData.get("password");
  const password = typeof raw === "string" ? raw : "";
  if (!password || password.length > MAX_PASSWORD_INPUT) {
    return { ok: false, message: "Wrong password." };
  }

  // Throttle before the password is even compared. If the attempts table
  // can't be reached, fail closed rather than allow unlimited guessing.
  let client: string;
  try {
    client = await clientKey(config.secret);
    const limit = await recordLoginAttempt(client);
    if (!limit.allowed) {
      return {
        ok: false,
        message: "Too many attempts. Wait a while and try again.",
      };
    }
  } catch (error) {
    console.error("login rate limit check failed", error);
    return {
      ok: false,
      message:
        "Login is unavailable: the server couldn't check the attempt limit. Make sure DATABASE_URL is set and `npm run migrate` has been run — see the README.",
    };
  }

  if (!(await safeEqual(password, config.password))) {
    // Small fixed delay on top of the rate limit.
    await new Promise((resolve) => setTimeout(resolve, 400));
    return { ok: false, message: "Wrong password." };
  }

  try {
    await clearLoginAttempts(client);
  } catch (error) {
    // Not fatal: the attempts age out on their own.
    console.error("couldn't clear login attempts", error);
  }

  const { token, expires } = await createSessionToken(config);
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
