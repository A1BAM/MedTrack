import HistoryList from "@/components/HistoryList";
import SetupNotice from "@/components/SetupNotice";
import { db, friendlyDbError, mapDose, mapPeak } from "@/lib/db";
import type { Dose, Peak } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  let doses: Dose[] = [];
  let peaks: Peak[] = [];
  let dbError: string | null = null;
  try {
    const sql = db();
    const [doseRows, peakRows] = await Promise.all([
      sql`select id, taken_at, amount::float8 as amount, notes
          from doses order by taken_at desc limit 200`,
      sql`select id, dose_id, peak_at, recorded_at, side_effects, notes
          from peaks order by peak_at desc limit 400`,
    ]);
    doses = doseRows.map(mapDose);
    peaks = peakRows.map(mapPeak);
  } catch (error) {
    dbError = friendlyDbError(error);
  }

  return (
    <main className="space-y-7">
      <header className="space-y-1.5">
        <h1 className="screen-title">History</h1>
        <p className="text-[13.5px] leading-relaxed text-ink-2">
          Doses with their peaks, newest first.
        </p>
      </header>
      {dbError ? (
        <SetupNotice message={dbError} />
      ) : (
        <HistoryList doses={doses} peaks={peaks} />
      )}
    </main>
  );
}
