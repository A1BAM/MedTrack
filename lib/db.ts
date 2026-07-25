import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { Dose, Peak } from "./types";

let client: NeonQueryFunction<false, false> | null = null;

export function db() {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is not set");
    }
    client = neon(url);
  }
  return client;
}

function toIso(value: unknown): string {
  return value instanceof Date
    ? value.toISOString()
    : new Date(String(value)).toISOString();
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function mapDose(row: Record<string, any>): Dose {
  return {
    id: Number(row.id),
    takenAt: toIso(row.taken_at),
    amount: Number(row.amount),
    notes: row.notes ?? null,
  };
}

export function mapPeak(row: Record<string, any>): Peak {
  return {
    id: Number(row.id),
    doseId: row.dose_id == null ? null : Number(row.dose_id),
    peakAt: toIso(row.peak_at),
    recordedAt: toIso(row.recorded_at),
    sideEffects: row.side_effects ?? null,
    notes: row.notes ?? null,
  };
}

export function toIsoOrNull(value: unknown): string | null {
  return value == null ? null : toIso(value);
}

export function friendlyDbError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("DATABASE_URL")) {
    return "DATABASE_URL is not set. Add your Neon connection string to .env.local (locally) or as a Cloudflare Worker secret — see the README.";
  }
  if (message.includes("does not exist")) {
    return "The database is missing the latest tables or columns. Run `npm run migrate`, or paste the newest file in migrations/ into the Neon SQL editor — see the README.";
  }
  return `Database error: ${message}`;
}
