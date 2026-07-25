"use client";

import { useEffect, useState } from "react";
import { fmtAgo, fmtDateTime, fmtTime } from "@/lib/format";

// Renders timestamps in the viewer's timezone, after mount, so the server's
// timezone never leaks into the page (and hydration stays clean).
export function LocalTime({
  iso,
  mode = "datetime",
}: {
  iso: string;
  mode?: "time" | "datetime";
}) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    setLabel(mode === "time" ? fmtTime(iso) : fmtDateTime(iso));
  }, [iso, mode]);
  return <span suppressHydrationWarning>{label}</span>;
}

// Reference only: dose time + the medication's typical duration. Nothing is
// recorded against this — it just answers "when should this wear off?".
export function WearOff({
  iso,
  hours,
}: {
  iso: string;
  hours: number;
}) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    const endsAt = new Date(iso).getTime() + hours * 3_600_000;
    const update = () =>
      setLabel(
        `${Date.now() > endsAt ? "Should have worn off around" : "Typically wears off around"} ${fmtTime(
          new Date(endsAt).toISOString()
        )}`
      );
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, [iso, hours]);
  return <span suppressHydrationWarning>{label}</span>;
}

export function TimeAgo({ iso }: { iso: string }) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    const update = () => setLabel(fmtAgo(iso));
    update();
    const timer = setInterval(update, 30_000);
    return () => clearInterval(timer);
  }, [iso]);
  return <span suppressHydrationWarning>{label}</span>;
}
