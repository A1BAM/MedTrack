"use server";

import { revalidatePath } from "next/cache";
import { AUTO_LINK_WINDOW_HOURS } from "./config";
import { db, friendlyDbError } from "./db";
import type { ActionResult } from "./types";

function revalidateAll() {
  for (const path of ["/", "/check-in", "/history", "/trends"]) {
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

export async function createCheckIn(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const effectiveness = Number(formData.get("effectiveness"));
    if (
      !Number.isInteger(effectiveness) ||
      effectiveness < 0 ||
      effectiveness > 10
    ) {
      return { ok: false, message: "Pick an effectiveness rating from 0 to 10." };
    }
    const sideEffects = text(formData.get("side_effects"));
    const notes = text(formData.get("notes"));
    const linkMode = String(formData.get("link_mode") ?? "auto");

    const sql = db();
    let doseId: number | null = null;
    if (linkMode === "auto") {
      // Most recent dose within the auto-link window, resolved at save time.
      const rows = await sql`
        select id from doses
        where taken_at <= now()
          and taken_at >= now() - make_interval(hours => ${AUTO_LINK_WINDOW_HOURS})
        order by taken_at desc
        limit 1`;
      doseId = rows.length ? Number(rows[0].id) : null;
    } else if (linkMode !== "none") {
      const parsed = Number(linkMode);
      if (!Number.isInteger(parsed)) {
        return { ok: false, message: "Invalid dose selection." };
      }
      doseId = parsed;
    }

    await sql`insert into check_ins (dose_id, effectiveness, side_effects, notes)
              values (${doseId}, ${effectiveness}, ${sideEffects}, ${notes})`;
    revalidateAll();
    return {
      ok: true,
      message: doseId
        ? "Check-in saved and linked to your dose."
        : "Check-in saved (not linked to a dose).",
    };
  } catch (error) {
    return { ok: false, message: friendlyDbError(error) };
  }
}

export async function setCheckInLink(
  checkInId: number,
  doseId: number | null
): Promise<ActionResult> {
  try {
    const sql = db();
    await sql`update check_ins set dose_id = ${doseId} where id = ${checkInId}`;
    revalidateAll();
    return {
      ok: true,
      message: doseId ? "Check-in linked." : "Check-in unlinked.",
    };
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

export async function deleteCheckIn(checkInId: number): Promise<ActionResult> {
  try {
    const sql = db();
    await sql`delete from check_ins where id = ${checkInId}`;
    revalidateAll();
    return { ok: true, message: "Check-in deleted." };
  } catch (error) {
    return { ok: false, message: friendlyDbError(error) };
  }
}
