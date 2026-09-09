"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { HALF_LIFE_HOURS, TIME_TO_PEAK_HOURS } from "@/lib/config";
import { amountInBody, type DoseEvent } from "@/lib/pk";
import type { Dose } from "@/lib/types";

const HOUR_MS = 3_600_000;
const W = 340;
const H = 188;
const PAD_L = 30;
const PAD_R = 8;
const PAD_T = 12;
const BASE = 152; // y of the zero line
const STEP_MIN = 6; // curve resolution

const x = (hour: number) => PAD_L + (hour / 24) * (W - PAD_L - PAD_R);

// Smallest 1/2/5-style step that keeps the gridline count to four or fewer,
// so the axis stays readable at any dose size.
function gridStep(yMax: number): number {
  for (let p = -2; p <= 4; p++) {
    for (const m of [1, 2, 5]) {
      const step = m * Math.pow(10, p);
      if (Math.floor(yMax / step) <= 4) return step;
    }
  }
  return yMax;
}

const tickLabel = (v: number) =>
  Number.isInteger(v) ? String(v) : v.toFixed(1).replace(/\.0$/, "");

const clock = (d: Date) =>
  d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export default function LevelChart({ doses }: { doses: Dose[] }) {
  // Everything here depends on the viewer's clock and timezone, so it has to
  // wait for mount — same reason the rest of the app defers its timestamps.
  const [day, setDay] = useState<{ start: number; now: number } | null>(null);
  const [scrub, setScrub] = useState<number | null>(null); // hour into the day
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    setDay({ start: start.getTime(), now: now.getTime() });
  }, []);

  const events: DoseEvent[] = useMemo(
    () =>
      doses.map((d) => ({ at: new Date(d.takenAt).getTime(), mg: d.amount })),
    [doses]
  );

  const model = useMemo(() => {
    if (!day) return null;
    const samples: { hour: number; mg: number }[] = [];
    for (let m = 0; m <= 24 * 60; m += STEP_MIN) {
      samples.push({
        hour: m / 60,
        mg: amountInBody(events, day.start + m * 60_000),
      });
    }
    const peak = samples.reduce((max, s) => Math.max(max, s.mg), 0);
    const yMax = Math.max(peak * 1.18, 1);
    const y = (mg: number) => BASE - (mg / yMax) * (BASE - PAD_T);

    const path = samples
      .map((s, i) => `${i ? "L" : "M"}${x(s.hour).toFixed(1)} ${y(s.mg).toFixed(1)}`)
      .join("");
    const nowHour = (day.now - day.start) / HOUR_MS;
    const pastPts = samples.filter((s) => s.hour <= nowHour);
    const futurePts = samples.filter((s) => s.hour >= nowHour);
    const line = (pts: typeof samples) =>
      pts
        .map((s, i) => `${i ? "L" : "M"}${x(s.hour).toFixed(1)} ${y(s.mg).toFixed(1)}`)
        .join("");

    // Ticks only where a dose actually falls inside today.
    const marks = events
      .map((e) => (e.at - day.start) / HOUR_MS)
      .filter((h) => h >= 0 && h <= 24);

    // No gridlines on an empty day — they'd just crowd the "nothing yet" note.
    const ticks: number[] = [];
    if (peak > 0) {
      const step = gridStep(yMax);
      for (let v = step; v < yMax; v += step) ticks.push(v);
    }

    return {
      samples, peak, yMax, y, path, nowHour, marks, ticks,
      pastPath: line(pastPts),
      futurePath: futurePts.length > 1 ? line(futurePts) : "",
      areaPath: `${path}L${x(24).toFixed(1)} ${BASE}L${x(0).toFixed(1)} ${BASE}Z`,
    };
  }, [day, events]);

  const readAt = (hour: number) =>
    day ? amountInBody(events, day.start + hour * HOUR_MS) : 0;

  const track = (clientX: number) => {
    const el = svgRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * W;
    const hour = ((px - PAD_L) / (W - PAD_L - PAD_R)) * 24;
    const snapped = Math.round((hour * 60) / 5) * 5 / 60;
    setScrub(Math.min(24, Math.max(0, snapped)));
  };

  if (!day || !model) {
    return (
      <section className="rounded-[20px] border border-grid bg-card p-[18px]">
        <h2 className="eyebrow">Estimated level</h2>
        <div className="mt-3 h-[188px] animate-pulse rounded-[14px] bg-page" />
      </section>
    );
  }

  const shownHour = scrub ?? model.nowHour;
  const shownMg = readAt(shownHour);
  const shownAt = new Date(day.start + shownHour * HOUR_MS);
  const totalToday = events
    .filter((e) => e.at >= day.start && e.at <= day.start + 24 * HOUR_MS)
    .reduce((sum, e) => sum + e.mg, 0);

  return (
    <section className="rounded-[20px] border border-grid bg-card p-[18px]">
      <div className="flex items-baseline justify-between">
        <h2 className="eyebrow">Estimated level</h2>
        <span className="eyebrow text-accent">
          {totalToday > 0 ? `${totalToday} mg today` : "nothing today"}
        </span>
      </div>

      <div className="mt-2.5 flex items-baseline gap-2.5">
        <span className="num text-[34px] leading-none text-accent">
          {shownMg.toFixed(1)}
        </span>
        <span className="text-[13.5px] text-ink-2">
          mg <span className="text-muted">·</span>{" "}
          {scrub == null ? "now" : clock(shownAt)}
        </span>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="mt-2 w-full select-none"
        style={{ touchAction: "pan-y" }}
        role="img"
        aria-label={`Estimated amount in the body across today. ${shownMg.toFixed(1)} milligrams at ${clock(shownAt)}.`}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          track(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) track(e.clientX);
        }}
        onPointerUp={() => setScrub(null)}
        onPointerCancel={() => setScrub(null)}
      >
        {model.ticks.map((v) => (
          <g key={v}>
            <line
              x1={PAD_L} y1={model.y(v)} x2={W - PAD_R} y2={model.y(v)}
              stroke="var(--grid)" strokeWidth="1"
            />
            <text
              x={PAD_L - 6} y={model.y(v) + 3.5} textAnchor="end"
              fontSize="9.5" fill="var(--muted)"
            >
              {tickLabel(v)}
            </text>
          </g>
        ))}
        <line
          x1={PAD_L} y1={BASE} x2={W - PAD_R} y2={BASE}
          stroke="var(--axis)" strokeWidth="1"
        />

        {totalToday > 0 || model.peak > 0 ? (
          <>
            <path d={model.areaPath} fill="var(--wash)" />
            <path
              d={model.pastPath} fill="none" stroke="var(--series-1)"
              strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"
            />
            {model.futurePath && (
              <path
                d={model.futurePath} fill="none" stroke="var(--series-1)"
                strokeWidth="1.8" strokeDasharray="3 3" strokeLinecap="round"
                opacity="0.75"
              />
            )}
            <line
              x1={x(model.nowHour)} y1={PAD_T - 4} x2={x(model.nowHour)} y2={BASE}
              stroke="var(--axis)" strokeWidth="1" strokeDasharray="2 3"
            />
            {model.marks.map((h, i) => (
              <line
                key={i} x1={x(h)} y1={BASE + 1} x2={x(h)} y2={BASE + 7}
                stroke="var(--series-1)" strokeWidth="2" strokeLinecap="round"
              />
            ))}
          </>
        ) : (
          <text
            x={W / 2} y={BASE / 2 + 4} textAnchor="middle"
            fontSize="12" fill="var(--muted)"
          >
            No doses logged today.
          </text>
        )}

        {scrub != null && (
          <>
            <line
              x1={x(scrub)} y1={PAD_T - 4} x2={x(scrub)} y2={BASE}
              stroke="var(--series-1)" strokeWidth="1"
            />
            <circle
              cx={x(scrub)} cy={model.y(shownMg)} r="4"
              fill="var(--series-1)" stroke="var(--surface)" strokeWidth="1.8"
            />
          </>
        )}

        {[0, 6, 12, 18, 24].map((h) => (
          <text
            key={h} x={x(h)} y={BASE + 22}
            textAnchor={h === 0 ? "start" : h === 24 ? "end" : "middle"}
            fontSize="9.5" fill="var(--muted)"
          >
            {h === 0 || h === 24 ? "12a" : h === 12 ? "12p" : h < 12 ? `${h}a` : `${h - 12}p`}
          </text>
        ))}
      </svg>

      <p className="mt-1 text-[11px] leading-relaxed text-muted">
        Hold and drag across the chart to read any time of day. Modelled from a{" "}
        {HALF_LIFE_HOURS} h half-life peaking at {TIME_TO_PEAK_HOURS} h — real
        clearance varies several-fold between people, so this is a shape, not a
        measurement.
      </p>
    </section>
  );
}
