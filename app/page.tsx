import Link from "next/link";
import DoseForm from "@/components/DoseForm";
import { Greeting, LocalTime, TimeAgo, WearOff } from "@/components/LocalTime";
import SetupNotice from "@/components/SetupNotice";
import {
  MED_NAME,
  TYPICAL_DOSE_MG,
  TYPICAL_DURATION_HOURS,
} from "@/lib/config";
import { db, friendlyDbError, mapDose } from "@/lib/db";
import { greeting } from "@/lib/format";
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
    <main className="space-y-7">
      <header className="space-y-1.5">
        <h1 className="screen-title">
          <Greeting initial={greeting()} />
        </h1>
        <p className="text-[13.5px] leading-relaxed text-ink-2">
          {MED_NAME} · {TYPICAL_DOSE_MG} mg typical, lasts about{" "}
          {TYPICAL_DURATION_HOURS} h
        </p>
      </header>

      {dbError ? (
        <SetupNotice message={dbError} />
      ) : (
        <>
          <DoseForm typicalDose={TYPICAL_DOSE_MG} />

          <section className="space-y-3.5 rounded-[20px] border border-grid bg-card p-[18px]">
            <div className="flex items-baseline justify-between">
              <h2 className="eyebrow">Last 24 hours</h2>
              {recent.length > 0 && (
                <span className="eyebrow text-accent">
                  {recent.length} {recent.length === 1 ? "dose" : "doses"}
                </span>
              )}
            </div>
            {lastDose ? (
              <>
                <div className="space-y-0.5">
                  <p className="text-[15px]">
                    Last dose <TimeAgo iso={lastDose.takenAt} />
                  </p>
                  <p className="text-[13.5px] text-muted">
                    <WearOff
                      iso={lastDose.takenAt}
                      hours={TYPICAL_DURATION_HOURS}
                    />
                  </p>
                </div>
                <ul className="border-t border-grid pt-1">
                  {recent.map((dose, i) => (
                    <li
                      key={dose.id}
                      className={`flex h-[42px] items-center justify-between ${
                        i ? "border-t border-grid" : ""
                      }`}
                    >
                      <span className="num text-[16px]">{dose.amount} mg</span>
                      <span className="text-[13.5px] text-ink-2">
                        <LocalTime iso={dose.takenAt} mode="time" />
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-[15px] text-ink-2">
                No doses logged in the last 24 hours.
              </p>
            )}
            <div className="border-t border-grid pt-3.5">
              <Link
                href="/history"
                className="text-[13.5px] font-medium text-accent"
              >
                Full history →
              </Link>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
