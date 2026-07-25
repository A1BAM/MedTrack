"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { logDose } from "@/lib/actions";

export default function DoseForm({ typicalDose }: { typicalDose: number }) {
  const [state, formAction, pending] = useActionState(logDose, null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [amount, setAmount] = useState(String(typicalDose));
  const [time, setTime] = useState(""); // datetime-local value, viewer's tz
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (state?.ok) {
      setAmount(String(typicalDose));
      setTime("");
      setNotes("");
      setAdjustOpen(false);
    }
  }, [state, typicalDose]);

  // datetime-local has no timezone; convert on the client where the local
  // timezone is the user's, and send an unambiguous ISO string.
  const takenAtIso = (() => {
    if (!time) return "";
    const parsed = new Date(time);
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
  })();

  const amountNumber = Number(amount);
  const amountValid = Number.isFinite(amountNumber) && amountNumber > 0;

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="amount" value={amount} />
      <input type="hidden" name="taken_at_iso" value={takenAtIso} />
      <input type="hidden" name="notes" value={notes} />

      <button
        type="submit"
        disabled={pending || !amountValid || (!!time && !takenAtIso)}
        className="h-20 w-full rounded-2xl bg-accent text-xl font-semibold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-60"
      >
        {pending
          ? "Logging…"
          : takenAtIso
            ? `Log ${amount} mg at chosen time`
            : `Log ${amount} mg now`}
      </button>

      <button
        type="button"
        onClick={() => setAdjustOpen((open) => !open)}
        className="text-sm text-ink-2 underline underline-offset-2"
      >
        {adjustOpen ? "Hide options" : "Different amount, time, or notes?"}
      </button>

      {adjustOpen && (
        <div className="space-y-3 rounded-xl border border-grid bg-card p-4">
          <label className="block text-sm font-medium">
            Amount (mg)
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 h-11 w-full rounded-lg border border-grid bg-page px-3 text-base"
            />
          </label>
          <label className="block text-sm font-medium">
            Time taken
            <input
              type="datetime-local"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="mt-1 h-11 w-full rounded-lg border border-grid bg-page px-3 text-base"
            />
            <span className="mt-1 block text-xs font-normal text-muted">
              Leave empty to use the current time.
            </span>
          </label>
          <label className="block text-sm font-medium">
            Notes
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. with food"
              className="mt-1 w-full rounded-lg border border-grid bg-page px-3 py-2 text-base"
            />
          </label>
        </div>
      )}

      {state && (
        <p
          className={`text-sm ${state.ok ? "text-good" : "text-danger"}`}
          role="status"
        >
          {state.message}{" "}
          {state.ok && (
            <Link
              href="/peak"
              className="font-medium text-accent underline underline-offset-2"
            >
              Log the peak when it hits →
            </Link>
          )}
        </p>
      )}
    </form>
  );
}
