"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { deleteDose, deletePeak, setPeakLink } from "@/lib/actions";
import { fmtDateTime, fmtDayHeading, fmtDuration, fmtTime } from "@/lib/format";
import type { Dose, Peak } from "@/lib/types";

const HOUR_MS = 3_600_000;

type TimelineItem =
  | { kind: "dose"; ts: number; dose: Dose; linked: Peak[] }
  | { kind: "peak"; ts: number; peak: Peak };

export default function HistoryList({
  doses,
  peaks,
}: {
  doses: Dose[];
  peaks: Peak[];
}) {
  // Day grouping and time labels depend on the viewer's timezone, so wait
  // for mount before rendering anything date-derived.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const groups = useMemo(() => {
    const linkedByDose = new Map<number, Peak[]>();
    for (const peak of peaks) {
      if (peak.doseId == null) continue;
      const list = linkedByDose.get(peak.doseId) ?? [];
      list.push(peak);
      linkedByDose.set(peak.doseId, list);
    }
    const items: TimelineItem[] = [
      ...doses.map((dose) => ({
        kind: "dose" as const,
        ts: new Date(dose.takenAt).getTime(),
        dose,
        linked: (linkedByDose.get(dose.id) ?? []).sort(
          (a, b) => new Date(a.peakAt).getTime() - new Date(b.peakAt).getTime()
        ),
      })),
      ...peaks
        .filter((peak) => peak.doseId == null)
        .map((peak) => ({
          kind: "peak" as const,
          ts: new Date(peak.peakAt).getTime(),
          peak,
        })),
    ].sort((a, b) => b.ts - a.ts);

    const byDay: { heading: string; items: TimelineItem[] }[] = [];
    for (const item of items) {
      const heading = fmtDayHeading(new Date(item.ts));
      const last = byDay[byDay.length - 1];
      if (last && last.heading === heading) {
        last.items.push(item);
      } else {
        byDay.push({ heading, items: [item] });
      }
    }
    return byDay;
  }, [doses, peaks]);

  if (!mounted) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((n) => (
          <div
            key={n}
            className="h-20 animate-pulse rounded-[20px] border border-grid bg-card"
          />
        ))}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <p className="rounded-[20px] border border-grid bg-card p-[18px] text-[13.5px] text-ink-2">
        Nothing logged yet. Log your first dose from the Log tab.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.heading}>
          <h2 className="eyebrow mb-2.5">
            {group.heading}
          </h2>
          <div className="space-y-3">
            {group.items.map((item) =>
              item.kind === "dose" ? (
                <DoseCard
                  key={`d${item.dose.id}`}
                  dose={item.dose}
                  linked={item.linked}
                  doses={doses}
                />
              ) : (
                <PeakCard
                  key={`p${item.peak.id}`}
                  peak={item.peak}
                  doses={doses}
                  standalone
                />
              )
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

function DoseCard({
  dose,
  linked,
  doses,
}: {
  dose: Dose;
  linked: Peak[];
  doses: Dose[];
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();

  const remove = () => {
    const suffix = linked.length
      ? ` Its ${linked.length} linked peak${linked.length > 1 ? "s" : ""} will be deleted too.`
      : "";
    if (!confirm(`Delete this dose?${suffix}`)) return;
    startTransition(async () => {
      await deleteDose(dose.id);
      router.refresh();
    });
  };

  return (
    <article
      className={`space-y-2.5 rounded-[20px] border border-grid bg-card p-4 ${busy ? "opacity-50" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p>
          <span className="num text-[18px]">{dose.amount} mg</span>{" "}
          <span className="text-[13.5px] text-ink-2">{fmtTime(dose.takenAt)}</span>
        </p>
        <DeleteButton onClick={remove} label="Delete dose" />
      </div>
      {dose.notes && <p className="text-[13.5px] text-ink-2">{dose.notes}</p>}
      {linked.map((peak) => (
        <PeakCard key={peak.id} peak={peak} doses={doses} dose={dose} />
      ))}
    </article>
  );
}

function PeakCard({
  peak,
  doses,
  dose,
  standalone = false,
}: {
  peak: Peak;
  doses: Dose[];
  dose?: Dose; // the dose it's linked to, when nested under one
  standalone?: boolean;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [editingLink, setEditingLink] = useState(false);

  const remove = () => {
    if (!confirm("Delete this peak?")) return;
    startTransition(async () => {
      await deletePeak(peak.id);
      router.refresh();
    });
  };

  const saveLink = (value: string) => {
    startTransition(async () => {
      await setPeakLink(peak.id, value === "none" ? null : Number(value));
      setEditingLink(false);
      router.refresh();
    });
  };

  const peakMs = new Date(peak.peakAt).getTime();
  const hoursAfter = dose
    ? (peakMs - new Date(dose.takenAt).getTime()) / HOUR_MS
    : null;

  // Sensible relink candidates: doses taken before this peak, up to 48 h
  // earlier — plus whatever it's currently linked to.
  const candidates = doses.filter((d) => {
    if (d.id === peak.doseId) return true;
    const takenTs = new Date(d.takenAt).getTime();
    return takenTs <= peakMs && peakMs - takenTs <= 48 * HOUR_MS;
  });

  return (
    <div
      className={`${
        standalone
          ? "space-y-2.5 rounded-[20px] border border-grid bg-card p-4"
          : "space-y-2.5 rounded-[14px] border border-grid bg-page p-3"
      } ${busy ? "opacity-50" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="flex flex-wrap items-center gap-x-2">
          <span className="inline-flex h-[26px] items-center rounded-full border border-accent px-[11px] text-[12.5px] font-medium text-accent">
            peak {fmtTime(peak.peakAt)}
          </span>
          {hoursAfter != null && hoursAfter >= 0 && (
            <span className="text-[13px] text-ink-2">
              <span className="num">{fmtDuration(hoursAfter)}</span> after dose
            </span>
          )}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setEditingLink((open) => !open)}
            aria-label="Change linked dose"
            title="Change linked dose"
            className="rounded-[10px] p-1.5 text-muted active:bg-grid"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4.5 w-4.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden
            >
              <path
                d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 1 0-6.4-6.4l-1.5 1.5M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 1 0 6.4 6.4l1.5-1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <DeleteButton onClick={remove} label="Delete peak" />
        </div>
      </div>
      {standalone && (
        <p className="text-xs text-muted">Not linked to a dose</p>
      )}
      {peak.sideEffects && (
        <p className="text-[13.5px]">
          <span className="text-muted">Side effects:</span> {peak.sideEffects}
        </p>
      )}
      {peak.notes && <p className="text-[13.5px] text-ink-2">{peak.notes}</p>}
      {editingLink && (
        <div className="flex items-center gap-2">
          <select
            defaultValue={peak.doseId == null ? "none" : String(peak.doseId)}
            onChange={(e) => saveLink(e.target.value)}
            disabled={busy}
            className="h-11 w-full rounded-[14px] border border-grid bg-card px-3 text-sm"
            aria-label="Linked dose"
          >
            <option value="none">No dose</option>
            {candidates.map((d) => (
              <option key={d.id} value={String(d.id)}>
                {fmtDateTime(d.takenAt)} · {d.amount} mg
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

function DeleteButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="rounded-[10px] p-1.5 text-muted active:bg-grid"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4.5 w-4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden
      >
        <path
          d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m3 0-1 13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1L6 7m4 4v6m4-6v6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
