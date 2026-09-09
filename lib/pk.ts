// A hypothetical "how much is still in me" curve for the Log screen.
//
// Standard one-compartment model with first-order absorption — the textbook
// oral-dose shape. For a single dose D taken h hours ago:
//
//   A(h) = D · ka/(ka−ke) · (e^(−ke·h) − e^(−ka·h))
//
// ke is the elimination rate from the half-life; ka is the absorption rate,
// derived from the time-to-peak rather than guessed, since Tmax and half-life
// are the two numbers actually quoted for a drug. Multiple doses superpose:
// each contributes independently and they add.
//
// This is a population-average model, not a measurement. Real clearance varies
// several-fold between people, so treat the curve as a shape, not a number.
import { HALF_LIFE_HOURS, TIME_TO_PEAK_HOURS } from "./config";

export type DoseEvent = { at: number; mg: number }; // `at` is epoch ms

const HOUR_MS = 3_600_000;

// Tmax = ln(ka/ke)/(ka−ke) is strictly decreasing in ka, from 1/ke down to 0,
// so a bisection finds the ka that puts the peak where we want it.
export function solveAbsorptionRate(ke: number, tmaxHours: number): number {
  if (!(tmaxHours > 0) || tmaxHours >= 1 / ke) return ke; // degenerate, see below
  let lo = ke * (1 + 1e-9);
  let hi = ke * 1000;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const tmax = Math.log(mid / ke) / (mid - ke);
    if (tmax > tmaxHours) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export const ELIMINATION_RATE = Math.LN2 / HALF_LIFE_HOURS;
export const ABSORPTION_RATE = solveAbsorptionRate(
  ELIMINATION_RATE,
  TIME_TO_PEAK_HOURS
);

// One dose's contribution, `hours` after it was taken.
export function amountFromDose(mg: number, hours: number): number {
  if (hours <= 0) return 0;
  const ka = ABSORPTION_RATE;
  const ke = ELIMINATION_RATE;
  // When ka and ke converge the general form divides by ~zero; the limit of
  // that expression is D·ke·h·e^(−ke·h).
  if (Math.abs(ka - ke) < 1e-6) {
    return mg * ke * hours * Math.exp(-ke * hours);
  }
  return (
    (mg * ka) / (ka - ke) * (Math.exp(-ke * hours) - Math.exp(-ka * hours))
  );
}

// Everything still on board at a given instant, summed over every dose.
export function amountInBody(doses: DoseEvent[], atMs: number): number {
  let total = 0;
  for (const dose of doses) {
    total += amountFromDose(dose.mg, (atMs - dose.at) / HOUR_MS);
  }
  return total;
}
