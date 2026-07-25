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

// A new peak auto-links to the most recent dose taken within this window.
export const AUTO_LINK_WINDOW_HOURS = 16;
