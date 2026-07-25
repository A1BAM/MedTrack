import SetupNotice from "@/components/SetupNotice";
import TrendCharts from "@/components/TrendCharts";
import { db, friendlyDbError, mapDose, toIsoOrNull } from "@/lib/db";
import type { Dose, TrendCheckIn } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TrendsPage() {
  let checkIns: TrendCheckIn[] = [];
  let doses: Dose[] = [];
  let dbError: string | null = null;
  try {
    const sql = db();
    const [checkInRows, doseRows] = await Promise.all([
      sql`select c.id, c.recorded_at, c.effectiveness, d.taken_at as dose_taken_at
          from check_ins c
          left join doses d on d.id = c.dose_id
          order by c.recorded_at asc`,
      sql`select id, taken_at, amount::float8 as amount, notes
          from doses order by taken_at asc`,
    ]);
    checkIns = checkInRows.map((row) => ({
      id: Number(row.id),
      recordedAt: new Date(String(row.recorded_at)).toISOString(),
      effectiveness: Number(row.effectiveness),
      doseTakenAt: toIsoOrNull(row.dose_taken_at),
    }));
    doses = doseRows.map(mapDose);
  } catch (error) {
    dbError = friendlyDbError(error);
  }

  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Trends</h1>
        <p className="text-sm text-ink-2">
          How well the medication is working over time.
        </p>
      </header>
      {dbError ? (
        <SetupNotice message={dbError} />
      ) : (
        <TrendCharts checkIns={checkIns} doses={doses} />
      )}
    </main>
  );
}
