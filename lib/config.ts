// Single-user, single-medication app: the medication is configured via env
// vars (with sensible fallbacks) instead of a table.
export const MED_NAME = process.env.NEXT_PUBLIC_MED_NAME ?? "My medication";
export const TYPICAL_DOSE_MG = Number(
  process.env.NEXT_PUBLIC_TYPICAL_DOSE_MG ?? "10"
);

// How long a dose typically lasts. Nothing is logged against this — it's a
// reference: the expected wear-off time on the Log screen, and a marker line
// on the trend charts to compare real peaks against.
export const TYPICAL_DURATION_HOURS = Number(
  process.env.NEXT_PUBLIC_TYPICAL_DURATION_HOURS ?? "4"
);

// Shape of the estimated-level curve on the Log screen (see lib/pk.ts).
// Defaults are the usual immediate-release figures: a 3 h half-life (quoted
// range 2–3.5 h in adults) peaking around 1.5 h after the dose.
export const HALF_LIFE_HOURS = Number(
  process.env.NEXT_PUBLIC_HALF_LIFE_HOURS ?? "3"
);
export const TIME_TO_PEAK_HOURS = Number(
  process.env.NEXT_PUBLIC_TIME_TO_PEAK_HOURS ?? "1.5"
);

// A new peak auto-links to the most recent dose taken within this window.
export const AUTO_LINK_WINDOW_HOURS = 16;
