"use client";

import { useActionState } from "react";
import { login } from "@/lib/auth-actions";

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(login, null);

  return (
    <form action={formAction} className="space-y-3">
      <input
        type="password"
        name="password"
        autoFocus
        autoComplete="current-password"
        placeholder="Password"
        aria-label="Password"
        className="h-12 w-full rounded-xl border border-grid bg-card px-4 text-base"
      />
      <button
        type="submit"
        disabled={pending}
        className="h-12 w-full rounded-xl bg-accent text-base font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
      >
        {pending ? "Checking…" : "Unlock"}
      </button>
      {state && !state.ok && (
        <p className="text-sm text-danger" role="alert">
          {state.message}
        </p>
      )}
    </form>
  );
}
