import HistoryList from "@/components/HistoryList";
import SetupNotice from "@/components/SetupNotice";
import { db, friendlyDbError, mapCheckIn, mapDose } from "@/lib/db";
import type { CheckIn, Dose } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  let doses: Dose[] = [];
  let checkIns: CheckIn[] = [];
  let dbError: string | null = null;
  try {
    const sql = db();
    const [doseRows, checkInRows] = await Promise.all([
      sql`select id, taken_at, amount::float8 as amount, notes
          from doses order by taken_at desc limit 200`,
      sql`select id, dose_id, recorded_at, effectiveness, side_effects, notes
          from check_ins order by recorded_at desc limit 400`,
    ]);
    doses = doseRows.map(mapDose);
    checkIns = checkInRows.map(mapCheckIn);
  } catch (error) {
    dbError = friendlyDbError(error);
  }

  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">History</h1>
        <p className="text-sm text-ink-2">
          Doses with their check-ins, newest first.
        </p>
      </header>
      {dbError ? (
        <SetupNotice message={dbError} />
      ) : (
        <HistoryList doses={doses} checkIns={checkIns} />
      )}
    </main>
  );
}
