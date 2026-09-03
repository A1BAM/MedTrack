"use client";

import { useActionState, useEffect, useState } from "react";
import { logPeak } from "@/lib/actions";
import { fmtDateTime, fmtDuration, fmtTime } from "@/lib/format";
import type { Dose } from "@/lib/types";

const HOUR_MS = 3_600_000;

export default function PeakForm({
  doses,
  windowHours,
}: {
  doses: Dose[]; // most recent first, last 48 h
  windowHours: number;
}) {
  const [state, formAction, pending] = useActionState(logPeak, null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [time, setTime] = useState(""); // datetime-local, viewer's tz
  const [sideEffects, setSideEffects] = useState("");
  const [notes, setNotes] = useState("");
  const [linkMode, setLinkMode] = useState("auto");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (state?.ok) {
      setTime("");
      setSideEffects("");
      setNotes("");
      setLinkMode("auto");
      setAdjustOpen(false);
    }
  }, [state]);

  // datetime-local carries no timezone; convert on the client, where local
  // time is the user's, and send an unambiguous ISO string.
  const peakAtIso = (() => {
    if (!time) return "";
    const parsed = new Date(time);
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
  })();

  // Preview of what "auto" resolves to (the server re-resolves on save).
  const peakMs = time && peakAtIso ? new Date(peakAtIso).getTime() : Date.now();
  const candidate = doses.find((dose) => {
    const taken = new Date(dose.takenAt).getTime();
    return taken <= peakMs && peakMs - taken <= windowHours * HOUR_MS;
  });
  const linkedDose =
    linkMode === "auto"
      ? candidate
      : linkMode === "none"
        ? undefined
        : doses.find((dose) => String(dose.id) === linkMode);
  const hoursAfter = linkedDose
    ? (peakMs - new Date(linkedDose.takenAt).getTime()) / HOUR_MS
    : null;

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="peak_at_iso" value={peakAtIso} />
      <input type="hidden" name="link_mode" value={linkMode} />
      <input type="hidden" name="side_effects" value={sideEffects} />
      <input type="hidden" name="notes" value={notes} />

      <button
        type="submit"
        disabled={pending || (!!time && !peakAtIso)}
        className="h-[86px] w-full rounded-[24px] bg-accent text-[18px] font-medium text-on-accent transition active:scale-[0.98] disabled:opacity-60"
      >
        {pending
          ? "Saving…"
          : peakAtIso
            ? "Log peak at chosen time"
            : "Peaking now"}
      </button>

      {mounted && (
        <p className="text-sm text-ink-2" aria-live="polite">
          {linkedDose && hoursAfter != null && hoursAfter >= 0 ? (
            <>
              <span className="font-medium text-ink">
                {fmtDuration(hoursAfter)}
              </span>{" "}
              after your {fmtTime(linkedDose.takenAt)} dose (
              {linkedDose.amount} mg)
            </>
          ) : (
            <>No dose in the last {windowHours} h — this saves unlinked.</>
          )}
        </p>
      )}

      <button
        type="button"
        onClick={() => setAdjustOpen((open) => !open)}
        className="text-[13.5px] text-ink-2 underline decoration-axis underline-offset-[3px]"
      >
        {adjustOpen ? "Hide options" : "Different time, dose, or notes?"}
      </button>

      {adjustOpen && (
        <div className="space-y-3.5 rounded-[20px] border border-grid bg-card p-[18px]">
          <label className="block text-[13px] font-medium text-ink-2">
            Time it peaked
            <input
              type="datetime-local"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-[14px] border border-grid bg-page px-3.5 text-base"
            />
            <span className="mt-1 block text-xs font-normal text-muted">
              Leave empty to use the current time.
            </span>
          </label>

          <div>
            <label className="text-[13px] font-medium text-ink-2" htmlFor="link-select">
              Linked dose
            </label>
            {mounted ? (
              <select
                id="link-select"
                value={linkMode}
                onChange={(e) => setLinkMode(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-[14px] border border-grid bg-page px-3.5 text-base"
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
              <div className="mt-1.5 h-11 rounded-[14px] border border-grid bg-page" />
            )}
          </div>

          <label className="block text-[13px] font-medium text-ink-2">
            Side effects
            <input
              type="text"
              value={sideEffects}
              onChange={(e) => setSideEffects(e.target.value)}
              placeholder="e.g. dry mouth, headache"
              className="mt-1.5 h-11 w-full rounded-[14px] border border-grid bg-page px-3.5 text-base"
            />
          </label>

          <label className="block text-[13px] font-medium text-ink-2">
            Notes
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Anything else worth remembering"
              className="mt-1.5 w-full rounded-[14px] border border-grid bg-page px-3.5 py-2.5 text-base"
            />
          </label>
        </div>
      )}

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
