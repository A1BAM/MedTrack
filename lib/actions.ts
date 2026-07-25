"use server";

import { revalidatePath } from "next/cache";
import { AUTO_LINK_WINDOW_HOURS } from "./config";
import { db, friendlyDbError } from "./db";
import { fmtDuration } from "./format";
import type { ActionResult } from "./types";

const HOUR_MS = 3_600_000;
// Tolerance for a phone clock running slightly ahead of the server's.
const FUTURE_SLACK_MS = 5 * 60_000;

function revalidateAll() {
  for (const path of ["/", "/peak", "/history", "/trends"]) {
    revalidatePath(path);
  }
}

function text(value: FormDataEntryValue | null): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

export async function logDose(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const amount = Number(formData.get("amount"));
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, message: "Enter a dose amount greater than 0." };
    }
    const notes = text(formData.get("notes"));
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
    return { ok: false, message: friendlyDbError(error) };
  }
}

export async function logPeak(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
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
    const sideEffects = text(formData.get("side_effects"));
    const notes = text(formData.get("notes"));
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
      if (!Number.isInteger(parsed)) {
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
    return { ok: false, message: friendlyDbError(error) };
  }
}

export async function setPeakLink(
  peakId: number,
  doseId: number | null
): Promise<ActionResult> {
  try {
    const sql = db();
    await sql`update peaks set dose_id = ${doseId} where id = ${peakId}`;
    revalidateAll();
    return { ok: true, message: doseId ? "Peak linked." : "Peak unlinked." };
  } catch (error) {
    return { ok: false, message: friendlyDbError(error) };
  }
}

export async function deleteDose(doseId: number): Promise<ActionResult> {
  try {
    const sql = db();
    await sql`delete from doses where id = ${doseId}`;
    revalidateAll();
    return { ok: true, message: "Dose deleted." };
  } catch (error) {
    return { ok: false, message: friendlyDbError(error) };
  }
}

export async function deletePeak(peakId: number): Promise<ActionResult> {
  try {
    const sql = db();
    await sql`delete from peaks where id = ${peakId}`;
    revalidateAll();
    return { ok: true, message: "Peak deleted." };
  } catch (error) {
    return { ok: false, message: friendlyDbError(error) };
  }
}
