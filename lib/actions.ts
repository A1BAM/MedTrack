"use server";

import { revalidatePath } from "next/cache";
import { AUTO_LINK_WINDOW_HOURS } from "./config";
import { db, friendlyDbError } from "./db";
import { fmtDuration } from "./format";
import { requireSession } from "./session";
import type { ActionResult } from "./types";

// Every exported function here is a public POST endpoint as far as the
// network is concerned. Each one checks the session itself (not just via
// middleware) and validates its inputs at runtime — TypeScript types aren't
// enforced on what a client actually sends.

const HOUR_MS = 3_600_000;
// Tolerance for a phone clock running slightly ahead of the server's.
const FUTURE_SLACK_MS = 5 * 60_000;
const MAX_TEXT_LENGTH = 2000;
const MAX_DOSE_MG = 100_000;

class ValidationError extends Error {}

function fail(error: unknown): ActionResult {
  if (error instanceof ValidationError) {
    return { ok: false, message: error.message };
  }
  return { ok: false, message: friendlyDbError(error) };
}

function revalidateAll() {
  for (const path of ["/", "/peak", "/history", "/trends"]) {
    revalidatePath(path);
  }
}

function text(value: FormDataEntryValue | null, label: string): string | null {
  if (value != null && typeof value !== "string") {
    throw new ValidationError(`${label} must be text.`);
  }
  const trimmed = (value ?? "").trim();
  if (trimmed.length > MAX_TEXT_LENGTH) {
    throw new ValidationError(
      `${label} is too long (max ${MAX_TEXT_LENGTH} characters).`
    );
  }
  return trimmed || null;
}

function recordId(value: unknown): number {
  const id = typeof value === "string" ? Number(value) : value;
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) {
    throw new ValidationError("Invalid record id.");
  }
  return id;
}

export async function logDose(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await requireSession();
  try {
    const amount = Number(formData.get("amount"));
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, message: "Enter a dose amount greater than 0." };
    }
    if (amount > MAX_DOSE_MG) {
      return { ok: false, message: "That dose amount is too large." };
    }
    const notes = text(formData.get("notes"), "Notes");
    const takenAtIso = String(formData.get("taken_at_iso") ?? "").trim();

    const sql = db();
    if (takenAtIso) {
      const takenAt = new Date(takenAtIso);
      if (Number.isNaN(takenAt.getTime())) {
        return { ok: false, message: "That time couldn't be parsed." };
      }
      await sql`insert into doses (taken_at, amount, notes)
                values (${takenAt.toISOString()}, ${amount}, ${notes})`;
    } else {
      await sql`insert into doses (amount, notes) values (${amount}, ${notes})`;
    }
    revalidateAll();
    return { ok: true, message: `Logged ${amount} mg.` };
  } catch (error) {
    return fail(error);
  }
}

export async function logPeak(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await requireSession();
  try {
    const peakAtIso = String(formData.get("peak_at_iso") ?? "").trim();
    let peakAt = new Date();
    if (peakAtIso) {
      peakAt = new Date(peakAtIso);
      if (Number.isNaN(peakAt.getTime())) {
        return { ok: false, message: "That time couldn't be parsed." };
      }
      if (peakAt.getTime() > Date.now() + FUTURE_SLACK_MS) {
        return { ok: false, message: "That time is in the future." };
      }
    }
    const sideEffects = text(formData.get("side_effects"), "Side effects");
    const notes = text(formData.get("notes"), "Notes");
    const linkMode = String(formData.get("link_mode") ?? "auto");
    const peakIso = peakAt.toISOString();

    const sql = db();
    let doseId: number | null = null;
    let doseTakenAt: Date | null = null;

    if (linkMode === "auto") {
      // Most recent dose taken in the window *before the peak*, resolved at
      // save time rather than trusting whatever the form previewed.
      const rows = await sql`
        select id, taken_at from doses
        where taken_at <= ${peakIso}::timestamptz
          and taken_at >= ${peakIso}::timestamptz
                          - make_interval(hours => ${AUTO_LINK_WINDOW_HOURS})
        order by taken_at desc
        limit 1`;
      if (rows.length) {
        doseId = Number(rows[0].id);
        doseTakenAt = new Date(String(rows[0].taken_at));
      }
    } else if (linkMode !== "none") {
      const parsed = Number(linkMode);
      if (!Number.isSafeInteger(parsed) || parsed <= 0) {
        return { ok: false, message: "Invalid dose selection." };
      }
      const rows = await sql`select id, taken_at from doses where id = ${parsed}`;
      if (!rows.length) {
        return { ok: false, message: "That dose no longer exists." };
      }
      doseId = Number(rows[0].id);
      doseTakenAt = new Date(String(rows[0].taken_at));
    }

    await sql`insert into peaks (dose_id, peak_at, side_effects, notes)
              values (${doseId}, ${peakIso}, ${sideEffects}, ${notes})`;
    revalidateAll();

    if (doseId && doseTakenAt) {
      const hours = (peakAt.getTime() - doseTakenAt.getTime()) / HOUR_MS;
      return {
        ok: true,
        message: `Peak logged — ${fmtDuration(hours)} after your dose.`,
      };
    }
    return { ok: true, message: "Peak logged (not linked to a dose)." };
  } catch (error) {
    return fail(error);
  }
}

export async function setPeakLink(
  peakId: number,
  doseId: number | null
): Promise<ActionResult> {
  await requireSession();
  try {
    const peak = recordId(peakId);
    const dose = doseId === null ? null : recordId(doseId);
    const sql = db();
    await sql`update peaks set dose_id = ${dose} where id = ${peak}`;
    revalidateAll();
    return { ok: true, message: dose ? "Peak linked." : "Peak unlinked." };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteDose(doseId: number): Promise<ActionResult> {
  await requireSession();
  try {
    const id = recordId(doseId);
    const sql = db();
    await sql`delete from doses where id = ${id}`;
    revalidateAll();
    return { ok: true, message: "Dose deleted." };
  } catch (error) {
    return fail(error);
  }
}

export async function deletePeak(peakId: number): Promise<ActionResult> {
  await requireSession();
  try {
    const id = recordId(peakId);
    const sql = db();
    await sql`delete from peaks where id = ${id}`;
    revalidateAll();
    return { ok: true, message: "Peak deleted." };
  } catch (error) {
    return fail(error);
  }
}
