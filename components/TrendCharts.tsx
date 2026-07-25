"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TYPICAL_DURATION_HOURS } from "@/lib/config";
import { fmtDateTime, fmtDuration, fmtDurationShort } from "@/lib/format";
import type { Dose, TrendPeak } from "@/lib/types";

const RANGES = [
  { key: "7d", label: "7d", days: 7 },
  { key: "30d", label: "30d", days: 30 },
  { key: "90d", label: "90d", days: 90 },
  { key: "all", label: "All", days: null },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

type TimelinePoint = { id: number; t: number; hours: number };

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const MAX_HOURS = 17; // buckets 0..16 — matches the 16 h auto-link window

export default function TrendCharts({
  peaks,
  doses,
}: {
  peaks: TrendPeak[]; // peak_at ascending
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

    const hoursToPeak = (peak: TrendPeak): number | null => {
      if (!peak.doseTakenAt) return null;
      const hours =
        (new Date(peak.peakAt).getTime() -
          new Date(peak.doseTakenAt).getTime()) /
        HOUR_MS;
      return hours >= 0 && hours < MAX_HOURS ? hours : null;
    };

    const inRange = peaks.filter(
      (p) => new Date(p.peakAt).getTime() >= cutoff
    );
    const dosesInRange = doses.filter(
      (d) => new Date(d.takenAt).getTime() >= cutoff
    );

    const timeline: TimelinePoint[] = [];
    for (const peak of inRange) {
      const hours = hoursToPeak(peak);
      if (hours == null) continue;
      timeline.push({
        id: peak.id,
        t: new Date(peak.peakAt).getTime(),
        hours,
      });
    }
    const unlinked = inRange.length - timeline.length;

    const average = (list: TimelinePoint[]) =>
      list.length
        ? list.reduce((sum, p) => sum + p.hours, 0) / list.length
        : null;
    const avgNow = average(timeline);

    let delta: number | null = null;
    if (days != null && avgNow != null) {
      const prior: TimelinePoint[] = [];
      for (const peak of peaks) {
        const t = new Date(peak.peakAt).getTime();
        if (t < cutoff - days * DAY_MS || t >= cutoff) continue;
        const hours = hoursToPeak(peak);
        if (hours != null) prior.push({ id: peak.id, t, hours });
      }
      const avgPrior = average(prior);
      if (avgPrior != null) delta = avgNow - avgPrior;
    }

    // Keep the histogram tight around a short-acting medication, but widen it
    // if peaks actually land later than the typical duration.
    const observedMax = timeline.reduce((max, p) => Math.max(max, p.hours), 0);
    const bucketCount = Math.min(
      MAX_HOURS,
      Math.max(
        Math.ceil(TYPICAL_DURATION_HOURS) + 2,
        Math.ceil(observedMax) + 1
      )
    );
    const buckets = Array.from({ length: bucketCount }, (_, hour) => ({
      hour,
      count: 0,
    }));
    for (const point of timeline) {
      const bucket = buckets[Math.floor(point.hours)];
      if (bucket) bucket.count += 1;
    }

    return { days, inRange, dosesInRange, timeline, unlinked, avgNow, delta, buckets };
  }, [peaks, doses, range]);

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

  const { days, inRange, dosesInRange, timeline, unlinked, avgNow, delta, buckets } =
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
          label="Avg to peak"
          value={avgNow == null ? "—" : fmtDurationShort(avgNow)}
          sub={
            delta == null ? undefined : (
              <span className="text-ink-2">
                {delta > 0 ? "↑" : delta < 0 ? "↓" : "＝"}{" "}
                {fmtDurationShort(Math.abs(delta))} vs prior {days}d
              </span>
            )
          }
        />
        <StatTile label="Peaks" value={String(inRange.length)} />
        <StatTile label="Doses" value={String(dosesInRange.length)} />
      </div>

      {/* Time to peak over time */}
      <section className="rounded-2xl border border-grid bg-card p-4">
        <h2 className="text-sm font-semibold">Time to peak</h2>
        <p className="text-xs text-muted">
          Hours from dose to peak, one point per logged peak.
        </p>
        {timeline.length === 0 ? (
          <EmptyNote>
            No dose-linked peaks in this range yet.
          </EmptyNote>
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
                  domain={[
                    0,
                    (dataMax: number) =>
                      Math.max(
                        Math.ceil(dataMax),
                        Math.ceil(TYPICAL_DURATION_HOURS) + 1
                      ),
                  ]}
                  allowDecimals={false}
                  width={30}
                  tick={{ fill: "var(--muted)", fontSize: 11 }}
                  tickFormatter={(h: number) => `${h}h`}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={<TimelineTip />}
                  cursor={{ stroke: "var(--axis)", strokeDasharray: "3 3" }}
                />
                <ReferenceLine
                  y={TYPICAL_DURATION_HOURS}
                  stroke="var(--axis)"
                  strokeDasharray="4 4"
                  label={{
                    value: `wears off ~${TYPICAL_DURATION_HOURS} h`,
                    position: "insideTopLeft",
                    fill: "var(--muted)",
                    fontSize: 10,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="hours"
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
        {unlinked > 0 && (
          <p className="mt-2 text-xs text-muted">
            {unlinked} peak{unlinked === 1 ? "" : "s"} not linked to a dose,
            so not shown here.
          </p>
        )}
      </section>

      {/* Distribution of time to peak */}
      <section className="rounded-2xl border border-grid bg-card p-4">
        <h2 className="text-sm font-semibold">How long it usually takes</h2>
        <p className="text-xs text-muted">
          Number of peaks by hours after the dose. The dashed line is the
          typical {TYPICAL_DURATION_HOURS} h duration.
        </p>
        {timeline.length === 0 ? (
          <EmptyNote>Nothing to summarise in this range yet.</EmptyNote>
        ) : (
          <div className="mt-3 -ml-1">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={buckets}
                margin={{ top: 20, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid stroke="var(--grid)" vertical={false} />
                <XAxis
                  dataKey="hour"
                  tick={{ fill: "var(--muted)", fontSize: 11 }}
                  axisLine={{ stroke: "var(--axis)" }}
                  tickLine={false}
                  interval={buckets.length > 9 ? 1 : 0}
                  tickFormatter={(h: number) => `${h}h`}
                />
                <YAxis
                  allowDecimals={false}
                  width={28}
                  tick={{ fill: "var(--muted)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={<BucketTip />}
                  cursor={{ fill: "var(--grid)", fillOpacity: 0.5 }}
                />
                <ReferenceLine
                  x={TYPICAL_DURATION_HOURS}
                  stroke="var(--axis)"
                  strokeDasharray="4 4"
                  label={{
                    value: `~${TYPICAL_DURATION_HOURS} h`,
                    position: "top",
                    fill: "var(--muted)",
                    fontSize: 10,
                  }}
                />
                <Bar
                  dataKey="count"
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
                  <th className="py-1 pr-3 font-medium">Peak</th>
                  <th className="py-1 font-medium">After dose</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {[...inRange].reverse().map((peak) => {
                  const hours = peak.doseTakenAt
                    ? (new Date(peak.peakAt).getTime() -
                        new Date(peak.doseTakenAt).getTime()) /
                      HOUR_MS
                    : null;
                  return (
                    <tr key={peak.id} className="border-t border-grid">
                      <td className="py-1.5 pr-3">{fmtDateTime(peak.peakAt)}</td>
                      <td className="py-1.5 text-ink-2">
                        {hours == null || hours < 0 ? "—" : fmtDuration(hours)}
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
      <p className="mt-0.5 text-xl font-semibold">{value}</p>
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
        {fmtDuration(point.hours)} after dose
      </p>
    </div>
  );
}

function BucketTip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const bucket = payload[0].payload as { hour: number; count: number };
  return (
    <div className="rounded-lg border border-grid bg-card px-3 py-2 text-xs shadow-sm">
      <p className="text-muted">
        {bucket.hour}–{bucket.hour + 1} h after dose
      </p>
      <p className="font-semibold text-ink">
        {bucket.count} peak{bucket.count === 1 ? "" : "s"}
      </p>
    </div>
  );
}
