import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { CheckIn, Dose } from "./types";

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

export function mapCheckIn(row: Record<string, any>): CheckIn {
  return {
    id: Number(row.id),
    doseId: row.dose_id == null ? null : Number(row.dose_id),
    recordedAt: toIso(row.recorded_at),
    effectiveness: Number(row.effectiveness),
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
    return "DATABASE_URL is not set. Add your Neon connection string to .env.local (locally) or the Vercel project settings — see the README.";
  }
  if (message.includes("does not exist")) {
    return "The database tables are missing. Run `npm run migrate` once against your Neon database — see the README.";
  }
  return `Database error: ${message}`;
}
