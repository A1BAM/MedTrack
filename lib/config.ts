// Single-user, single-medication app: the medication is configured via env
// vars (with sensible fallbacks) instead of a table.
export const MED_NAME = process.env.NEXT_PUBLIC_MED_NAME ?? "My medication";
export const TYPICAL_DOSE_MG = Number(
  process.env.NEXT_PUBLIC_TYPICAL_DOSE_MG ?? "20"
);

// A new check-in auto-links to the most recent dose taken within this window.
export const AUTO_LINK_WINDOW_HOURS = 16;
