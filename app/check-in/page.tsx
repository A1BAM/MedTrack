import CheckInForm from "@/components/CheckInForm";
import SetupNotice from "@/components/SetupNotice";
import { AUTO_LINK_WINDOW_HOURS } from "@/lib/config";
import { db, friendlyDbError, mapDose } from "@/lib/db";
import type { Dose } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CheckInPage() {
  let recentDoses: Dose[] = [];
  let dbError: string | null = null;
  try {
    const sql = db();
    const rows = await sql`
      select id, taken_at, amount::float8 as amount, notes
      from doses
      where taken_at >= now() - interval '48 hours'
      order by taken_at desc
      limit 20`;
    recentDoses = rows.map(mapDose);
  } catch (error) {
    dbError = friendlyDbError(error);
  }

  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Check in</h1>
        <p className="text-sm text-ink-2">
          How is the medication working right now?
        </p>
      </header>
      {dbError ? (
        <SetupNotice message={dbError} />
      ) : (
        <CheckInForm
          doses={recentDoses}
          windowHours={AUTO_LINK_WINDOW_HOURS}
        />
      )}
    </main>
  );
}
