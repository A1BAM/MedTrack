import SetupNotice from "@/components/SetupNotice";
import TrendCharts from "@/components/TrendCharts";
import { db, friendlyDbError, mapDose, toIsoOrNull } from "@/lib/db";
import type { Dose, TrendPeak } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TrendsPage() {
  let peaks: TrendPeak[] = [];
  let doses: Dose[] = [];
  let dbError: string | null = null;
  try {
    const sql = db();
    const [peakRows, doseRows] = await Promise.all([
      sql`select p.id, p.peak_at, d.taken_at as dose_taken_at
          from peaks p
          left join doses d on d.id = p.dose_id
          order by p.peak_at asc`,
      sql`select id, taken_at, amount::float8 as amount, notes
          from doses order by taken_at asc`,
    ]);
    peaks = peakRows.map((row) => ({
      id: Number(row.id),
      peakAt: new Date(String(row.peak_at)).toISOString(),
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
          How long the medication takes to peak.
        </p>
      </header>
      {dbError ? (
        <SetupNotice message={dbError} />
      ) : (
        <TrendCharts peaks={peaks} doses={doses} />
      )}
    </main>
  );
}
