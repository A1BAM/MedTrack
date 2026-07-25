"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtDateTime } from "@/lib/format";
import type { Dose, TrendCheckIn } from "@/lib/types";

const RANGES = [
  { key: "7d", label: "7d", days: 7 },
  { key: "30d", label: "30d", days: 30 },
  { key: "90d", label: "90d", days: 90 },
  { key: "all", label: "All", days: null },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

type TimelinePoint = {
  t: number;
  effectiveness: number;
  hoursSince: number | null;
};

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const COURSE_HOURS = 17; // buckets 0..16 — matches the 16 h auto-link window

export default function TrendCharts({
  checkIns,
  doses,
}: {
  checkIns: TrendCheckIn[]; // recorded_at ascending
  doses: Dose[];
}) {
  const [range, setRange] = useState<RangeKey>("30d");
  // Range math uses Date.now(); render only after mount so SSR and client agree.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const view = useMemo(() => {
    const days = RANGES.find((r) => r.key === range)?.days ?? null;
    const now = Date.now();
    const cutoff = days == null ? -Infinity : now - days * DAY_MS;

    const inRange = checkIns.filter(
      (c) => new Date(c.recordedAt).getTime() >= cutoff
    );
    const dosesInRange = doses.filter(
      (d) => new Date(d.takenAt).getTime() >= cutoff
    );

    const avg = (list: TrendCheckIn[]) =>
      list.length
        ? list.reduce((sum, c) => sum + c.effectiveness, 0) / list.length
        : null;
    const avgNow = avg(inRange);

    let delta: number | null = null;
    if (days != null && avgNow != null) {
      const prev = checkIns.filter((c) => {
        const t = new Date(c.recordedAt).getTime();
        return t >= cutoff - days * DAY_MS && t < cutoff;
      });
      const avgPrev = avg(prev);
      if (avgPrev != null) delta = avgNow - avgPrev;
    }

    const timeline: TimelinePoint[] = inRange.map((c) => {
      const t = new Date(c.recordedAt).getTime();
      const hoursSince = c.doseTakenAt
        ? (t - new Date(c.doseTakenAt).getTime()) / HOUR_MS
        : null;
      return { t, effectiveness: c.effectiveness, hoursSince };
    });

    const buckets = Array.from({ length: COURSE_HOURS }, (_, hour) => ({
      hour,
      sum: 0,
      n: 0,
    }));
    for (const point of timeline) {
      if (point.hoursSince == null) continue;
      if (point.hoursSince < 0 || point.hoursSince >= COURSE_HOURS) continue;
      const bucket = buckets[Math.floor(point.hoursSince)];
      bucket.sum += point.effectiveness;
      bucket.n += 1;
    }
    const course = buckets.map((b) => ({
      hour: b.hour,
      avg: b.n ? b.sum / b.n : null,
      n: b.n,
    }));
    const linkedCount = course.reduce((sum, b) => sum + b.n, 0);

    return { days, inRange, dosesInRange, avgNow, delta, timeline, course, linkedCount };
  }, [checkIns, doses, range]);

  if (!mounted) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((n) => (
          <div
            key={n}
            className="h-40 animate-pulse rounded-2xl border border-grid bg-card"
          />
        ))}
      </div>
    );
  }

  const { days, inRange, dosesInRange, avgNow, delta, timeline, course, linkedCount } =
    view;

  return (
    <div className="space-y-4">
      {/* Filter row — one row, above the charts */}
      <div
        role="group"
        aria-label="Date range"
        className="grid grid-cols-4 gap-1 rounded-xl border border-grid bg-card p-1"
      >
        {RANGES.map((r) => (
          <button
            key={r.key}
            type="button"
            aria-pressed={range === r.key}
            onClick={() => setRange(r.key)}
            className={`h-9 rounded-lg text-sm font-medium transition ${
              range === r.key ? "bg-accent text-white" : "text-ink-2"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-3 gap-2">
        <StatTile
          label="Avg effect"
          value={avgNow == null ? "—" : avgNow.toFixed(1)}
          sub={
            delta == null ? undefined : (
              <span className={delta > 0 ? "text-good" : "text-ink-2"}>
                {delta > 0 ? "↑" : delta < 0 ? "↓" : "＝"}{" "}
                {Math.abs(delta).toFixed(1)} vs prior {days}d
              </span>
            )
          }
        />
        <StatTile label="Check-ins" value={String(inRange.length)} />
        <StatTile label="Doses" value={String(dosesInRange.length)} />
      </div>

      {/* Effectiveness over time */}
      <section className="rounded-2xl border border-grid bg-card p-4">
        <h2 className="text-sm font-semibold">Effectiveness over time</h2>
        <p className="text-xs text-muted">Each point is one check-in, 0–10.</p>
        {timeline.length === 0 ? (
          <EmptyNote>No check-ins in this range yet.</EmptyNote>
        ) : (
          <div className="mt-3 -ml-1">
            <ResponsiveContainer width="100%" height={230}>
              <ComposedChart
                data={timeline}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid stroke="var(--grid)" vertical={false} />
                <XAxis
                  dataKey="t"
                  type="number"
                  scale="time"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(t: number) =>
                    new Date(t).toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                    })
                  }
                  tick={{ fill: "var(--muted)", fontSize: 11 }}
                  axisLine={{ stroke: "var(--axis)" }}
                  tickLine={false}
                  minTickGap={32}
                />
                <YAxis
                  domain={[0, 10]}
                  ticks={[0, 2, 4, 6, 8, 10]}
                  width={28}
                  tick={{ fill: "var(--muted)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={<TimelineTip />}
                  cursor={{ stroke: "var(--axis)", strokeDasharray: "3 3" }}
                />
                <Line
                  type="monotone"
                  dataKey="effectiveness"
                  stroke="var(--series-1)"
                  strokeWidth={2}
                  dot={{
                    r: 4,
                    fill: "var(--series-1)",
                    stroke: "var(--surface)",
                    strokeWidth: 2,
                  }}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Time course after a dose */}
      <section className="rounded-2xl border border-grid bg-card p-4">
        <h2 className="text-sm font-semibold">
          Average effectiveness by hours after dose
        </h2>
        <p className="text-xs text-muted">
          Linked check-ins only. Shows when a dose kicks in and wears off.
        </p>
        {linkedCount === 0 ? (
          <EmptyNote>
            No dose-linked check-ins in this range yet.
          </EmptyNote>
        ) : (
          <div className="mt-3 -ml-1">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={course}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid stroke="var(--grid)" vertical={false} />
                <XAxis
                  dataKey="hour"
                  tick={{ fill: "var(--muted)", fontSize: 11 }}
                  axisLine={{ stroke: "var(--axis)" }}
                  tickLine={false}
                  interval={1}
                  tickFormatter={(h: number) => `${h}h`}
                />
                <YAxis
                  domain={[0, 10]}
                  ticks={[0, 2, 4, 6, 8, 10]}
                  width={28}
                  tick={{ fill: "var(--muted)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={<CourseTip />}
                  cursor={{ fill: "var(--grid)", fillOpacity: 0.5 }}
                />
                <Bar
                  dataKey="avg"
                  fill="var(--series-1)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={14}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Table view of the same data */}
      {inRange.length > 0 && (
        <details className="rounded-2xl border border-grid bg-card p-4">
          <summary className="cursor-pointer text-sm font-semibold">
            View as table
          </summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="py-1 pr-3 font-medium">When</th>
                  <th className="py-1 pr-3 font-medium">Effect</th>
                  <th className="py-1 font-medium">After dose</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {[...inRange].reverse().map((c) => {
                  const hoursSince = c.doseTakenAt
                    ? (new Date(c.recordedAt).getTime() -
                        new Date(c.doseTakenAt).getTime()) /
                      HOUR_MS
                    : null;
                  return (
                    <tr key={c.id} className="border-t border-grid">
                      <td className="py-1.5 pr-3">{fmtDateTime(c.recordedAt)}</td>
                      <td className="py-1.5 pr-3">{c.effectiveness}/10</td>
                      <td className="py-1.5 text-ink-2">
                        {hoursSince == null ? "—" : `${hoursSince.toFixed(1)} h`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}

function StatTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-grid bg-card p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] leading-tight">{sub}</p>}
    </div>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-sm text-ink-2">{children}</p>;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function TimelineTip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const point: TimelinePoint = payload[0].payload;
  return (
    <div className="rounded-lg border border-grid bg-card px-3 py-2 text-xs shadow-sm">
      <p className="text-muted">{fmtDateTime(new Date(point.t).toISOString())}</p>
      <p className="font-semibold text-ink">
        Effectiveness {point.effectiveness}/10
      </p>
      {point.hoursSince != null && (
        <p className="text-ink-2">{point.hoursSince.toFixed(1)} h after dose</p>
      )}
    </div>
  );
}

function CourseTip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const bucket = payload[0].payload as { hour: number; avg: number | null; n: number };
  if (bucket.avg == null) return null;
  return (
    <div className="rounded-lg border border-grid bg-card px-3 py-2 text-xs shadow-sm">
      <p className="text-muted">
        {bucket.hour}–{bucket.hour + 1} h after dose
      </p>
      <p className="font-semibold text-ink">Avg {bucket.avg.toFixed(1)}/10</p>
      <p className="text-ink-2">
        {bucket.n} check-in{bucket.n === 1 ? "" : "s"}
      </p>
    </div>
  );
}
