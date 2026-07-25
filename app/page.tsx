import Link from "next/link";
import DoseForm from "@/components/DoseForm";
import { LocalTime, TimeAgo, WearOff } from "@/components/LocalTime";
import SetupNotice from "@/components/SetupNotice";
import {
  MED_NAME,
  TYPICAL_DOSE_MG,
  TYPICAL_DURATION_HOURS,
} from "@/lib/config";
import { db, friendlyDbError, mapDose } from "@/lib/db";
import type { Dose } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LogPage() {
  let recent: Dose[] = [];
  let dbError: string | null = null;
  try {
    const sql = db();
    const rows = await sql`
      select id, taken_at, amount::float8 as amount, notes
      from doses
      where taken_at >= now() - interval '24 hours'
      order by taken_at desc`;
    recent = rows.map(mapDose);
  } catch (error) {
    dbError = friendlyDbError(error);
  }

  const lastDose = recent[0] ?? null;

  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">{MED_NAME}</h1>
        <p className="text-sm text-ink-2">
          Typical dose {TYPICAL_DOSE_MG} mg · lasts about{" "}
          {TYPICAL_DURATION_HOURS} h
        </p>
      </header>

      {dbError ? (
        <SetupNotice message={dbError} />
      ) : (
        <>
          <DoseForm typicalDose={TYPICAL_DOSE_MG} />

          <section className="rounded-2xl border border-grid bg-card p-4">
            <h2 className="text-sm font-semibold">Last 24 hours</h2>
            {lastDose ? (
              <>
                <p className="mt-1 text-sm text-ink-2">
                  Last dose <TimeAgo iso={lastDose.takenAt} /> (
                  {lastDose.amount} mg)
                </p>
                <p className="text-sm text-muted">
                  <WearOff
                    iso={lastDose.takenAt}
                    hours={TYPICAL_DURATION_HOURS}
                  />
                </p>
                <ul className="mt-3 space-y-2">
                  {recent.map((dose) => (
                    <li
                      key={dose.id}
                      className="flex items-baseline justify-between text-sm"
                    >
                      <span className="font-medium">{dose.amount} mg</span>
                      <span className="text-ink-2">
                        <LocalTime iso={dose.takenAt} mode="time" />
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-1 text-sm text-ink-2">
                No doses logged in the last 24 hours.
              </p>
            )}
            <Link
              href="/history"
              className="mt-3 inline-block text-sm font-medium text-accent underline underline-offset-2"
            >
              Full history
            </Link>
          </section>
        </>
      )}
    </main>
  );
}
