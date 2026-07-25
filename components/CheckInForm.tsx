"use client";

import { useActionState, useEffect, useState } from "react";
import { createCheckIn } from "@/lib/actions";
import { fmtDateTime } from "@/lib/format";
import type { Dose } from "@/lib/types";

const SCORES = Array.from({ length: 11 }, (_, n) => n);

export default function CheckInForm({
  doses,
  windowHours,
}: {
  doses: Dose[]; // most recent first, last 48 h
  windowHours: number;
}) {
  const [state, formAction, pending] = useActionState(createCheckIn, null);
  const [effectiveness, setEffectiveness] = useState<number | null>(null);
  const [sideEffects, setSideEffects] = useState("");
  const [notes, setNotes] = useState("");
  const [linkMode, setLinkMode] = useState("auto");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (state?.ok) {
      setEffectiveness(null);
      setSideEffects("");
      setNotes("");
      setLinkMode("auto");
    }
  }, [state]);

  // What "auto" will resolve to (the server re-resolves at save time).
  const candidate = doses.find((dose) => {
    const taken = new Date(dose.takenAt).getTime();
    return taken <= Date.now() && Date.now() - taken <= windowHours * 3_600_000;
  });

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="effectiveness" value={effectiveness ?? ""} />
      <input type="hidden" name="link_mode" value={linkMode} />
      <input type="hidden" name="side_effects" value={sideEffects} />
      <input type="hidden" name="notes" value={notes} />

      <fieldset>
        <legend className="text-sm font-medium">Effectiveness</legend>
        <div className="mt-2 grid grid-cols-6 gap-2">
          {SCORES.map((score) => (
            <button
              key={score}
              type="button"
              aria-pressed={effectiveness === score}
              onClick={() => setEffectiveness(score)}
              className={`h-12 rounded-xl border text-base font-semibold transition ${
                effectiveness === score
                  ? "border-accent bg-accent text-white"
                  : "border-grid bg-card text-ink active:bg-page"
              }`}
            >
              {score}
            </button>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-xs text-muted">
          <span>Not working</span>
          <span>Working great</span>
        </div>
      </fieldset>

      <div>
        <label className="text-sm font-medium" htmlFor="link-select">
          Linked dose
        </label>
        {mounted ? (
          <select
            id="link-select"
            value={linkMode}
            onChange={(e) => setLinkMode(e.target.value)}
            className="mt-1 h-11 w-full rounded-lg border border-grid bg-card px-3 text-base"
          >
            <option value="auto">
              {candidate
                ? `Auto — ${fmtDateTime(candidate.takenAt)} · ${candidate.amount} mg`
                : "Auto — no recent dose (saves unlinked)"}
            </option>
            {doses.map((dose) => (
              <option key={dose.id} value={String(dose.id)}>
                {fmtDateTime(dose.takenAt)} · {dose.amount} mg
              </option>
            ))}
            <option value="none">Don&rsquo;t link to a dose</option>
          </select>
        ) : (
          <div className="mt-1 h-11 rounded-lg border border-grid bg-card" />
        )}
        {linkMode === "auto" && (
          <p className="mt-1 text-xs text-muted">
            Auto picks the most recent dose from the last {windowHours} hours.
          </p>
        )}
      </div>

      <label className="block text-sm font-medium">
        Side effects
        <input
          type="text"
          value={sideEffects}
          onChange={(e) => setSideEffects(e.target.value)}
          placeholder="e.g. dry mouth, headache"
          className="mt-1 h-11 w-full rounded-lg border border-grid bg-card px-3 text-base"
        />
      </label>

      <label className="block text-sm font-medium">
        Notes
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Anything else worth remembering"
          className="mt-1 w-full rounded-lg border border-grid bg-card px-3 py-2 text-base"
        />
      </label>

      <button
        type="submit"
        disabled={pending || effectiveness === null}
        className="h-14 w-full rounded-2xl bg-accent text-lg font-semibold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-60"
      >
        {pending
          ? "Saving…"
          : effectiveness === null
            ? "Pick a rating first"
            : "Save check-in"}
      </button>

      {state && (
        <p
          className={`text-sm ${state.ok ? "text-good" : "text-danger"}`}
          role="status"
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
