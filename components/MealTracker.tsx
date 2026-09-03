"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  KCAL_TARGET,
  MAINTENANCE_KCAL,
  MEAL_PLAN,
  PROTEIN_FLOOR_G,
  QUICK_ADD,
  type Extra,
  type QuickItem,
  easternDay,
  easternDayHeading,
  loadMealDay,
  newExtraId,
  pruneOtherDays,
  saveMealDay,
  sectionKcal,
  totals,
} from "@/lib/meals";

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

// How often to re-check whether the Eastern day rolled over while the page sat
// open. Cheap, and unlike a single timeout to midnight it can't be thrown off
// by a DST shift or a sleeping phone.
const DAY_CHECK_MS = 30_000;

export default function MealTracker() {
  const [day, setDay] = useState(() => easternDay());
  const [heading, setHeading] = useState("");
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [extras, setExtras] = useState<Extra[]>([]);
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Read the stored day only after mount — localStorage doesn't exist on the
  // server, so the first render has to be the empty plan either way.
  const openDay = useCallback((nextDay: string) => {
    const stored = loadMealDay(nextDay);
    setDay(nextDay);
    setChecked(new Set(stored.checked));
    setExtras(stored.extras);
    setHeading(easternDayHeading());
    pruneOtherDays(nextDay);
  }, []);

  useEffect(() => {
    openDay(easternDay());
  }, [openDay]);

  // Midnight Eastern: if the day has changed under us, swap to the new (empty)
  // one. Also checked whenever the tab comes back to the foreground, since
  // background timers on a locked phone are unreliable.
  useEffect(() => {
    const check = () => {
      const now = easternDay();
      if (now !== day) openDay(now);
    };
    const timer = setInterval(check, DAY_CHECK_MS);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, [day, openDay]);

  const persist = (nextChecked: Set<string>, nextExtras: Extra[]) => {
    saveMealDay(day, { checked: [...nextChecked], extras: nextExtras });
  };

  const toggle = (id: string) => {
    const next = new Set(checked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setChecked(next);
    persist(next, extras);
  };

  const addExtra = (entry: Omit<Extra, "id">) => {
    const next = [...extras, { ...entry, id: newExtraId() }];
    setExtras(next);
    persist(checked, next);
  };

  const removeExtra = (id: string) => {
    const next = extras.filter((extra) => extra.id !== id);
    setExtras(next);
    persist(checked, next);
  };

  const clearToday = () => {
    const next = new Set<string>();
    setChecked(next);
    setExtras([]);
    persist(next, []);
  };

  const t = totals(checked, extras);
  const left = KCAL_TARGET - t.kcal;
  const over = left < 0;
  const proteinPct = Math.min(100, (t.protein / PROTEIN_FLOOR_G) * 100);
  const proteinDone = t.protein >= PROTEIN_FLOOR_G;
  const deficit = MAINTENANCE_KCAL - t.kcal;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-grid bg-card p-4">
        <div className="flex items-baseline justify-between text-xs text-muted">
          <span suppressHydrationWarning>{heading || "Today"}</span>
          <span>
            {t.kcal === 0
              ? "nothing logged yet"
              : `${(deficit / 500).toFixed(1)} lb/wk at this pace`}
          </span>
        </div>

        <div className="mt-3 flex items-end gap-3">
          <span
            className={`text-6xl leading-none font-semibold tabular-nums tracking-tight ${
              over ? "text-danger" : "text-accent"
            }`}
          >
            {fmt(Math.abs(left))}
          </span>
          <span className="pb-1 text-sm">
            <span className="block font-medium">
              calories {over ? "over" : "left"}
            </span>
            <span className="block text-ink-2">
              <span className="tabular-nums">{fmt(t.kcal)}</span> eaten of{" "}
              <span className="tabular-nums">{fmt(KCAL_TARGET)}</span>
            </span>
          </span>
        </div>

        <div className="mt-4 border-t border-grid pt-3">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium">Protein</span>
            <span className="text-ink-2 tabular-nums">
              {fmt(t.protein)} of {PROTEIN_FLOOR_G} g
            </span>
          </div>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-grid"
            role="progressbar"
            aria-label="Protein against the daily floor"
            aria-valuemin={0}
            aria-valuemax={PROTEIN_FLOOR_G}
            aria-valuenow={Math.round(t.protein)}
          >
            <div
              className={`h-full transition-[width] duration-300 ${
                proteinDone ? "bg-good" : "bg-axis"
              }`}
              style={{ width: `${proteinPct}%` }}
            />
          </div>
          <p
            className={`mt-2 text-xs ${proteinDone ? "text-good" : "text-muted"}`}
          >
            {proteinDone
              ? "Cleared. Anything above this is free."
              : `${fmt(PROTEIN_FLOOR_G - t.protein)} g to go. This is a floor, not a cap.`}
          </p>
        </div>

        <div className="mt-3 flex gap-5 border-t border-grid pt-3 text-xs text-ink-2">
          <span>
            Carbs <b className="text-sm tabular-nums text-ink">{fmt(t.carbs)}</b>g
          </span>
          <span>
            Fat <b className="text-sm tabular-nums text-ink">{fmt(t.fat)}</b>g
          </span>
          <span>
            Deficit{" "}
            <b className="text-sm tabular-nums text-ink">{fmt(deficit)}</b>
          </span>
        </div>
      </section>

      {MEAL_PLAN.map((section) => {
        const sub = sectionKcal(section, checked);
        return (
          <section key={section.name}>
            <div className="flex items-baseline justify-between border-b border-grid pb-2">
              <h2 className="text-sm font-semibold text-ink-2">
                {section.name}
              </h2>
              <span
                className={`text-xs tabular-nums ${
                  sub ? "font-semibold text-accent" : "text-muted"
                }`}
              >
                {sub ? `${fmt(sub)} kcal` : "—"}
              </span>
            </div>
            <ul>
              {section.items.map((entry) => {
                const on = checked.has(entry.id);
                return (
                  <li key={entry.id} className="border-b border-grid last:border-0">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => toggle(entry.id)}
                      className="flex w-full items-center gap-3 py-3 text-left"
                    >
                      <Check on={on} />
                      <span className={`flex-1 text-[15px] ${on ? "text-ink-2" : ""}`}>
                        {entry.label}
                      </span>
                      <span
                        className={`text-sm tabular-nums ${on ? "text-ink-2" : "text-muted"}`}
                      >
                        {fmt(entry.kcal)}
                        <span className="text-xs"> · {fmt(entry.protein)}p</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {extras.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between border-b border-grid pb-2">
            <h2 className="text-sm font-semibold text-ink-2">Added</h2>
            <span className="text-xs font-semibold tabular-nums text-accent">
              {fmt(extras.reduce((acc, extra) => acc + extra.kcal, 0))} kcal
            </span>
          </div>
          <ul>
            {extras.map((extra) => (
              <li
                key={extra.id}
                className="flex items-center gap-3 border-b border-grid py-3 last:border-0"
              >
                <Check on />
                <span className="flex-1 text-[15px] text-ink-2">
                  {extra.label}
                </span>
                <span className="text-sm tabular-nums text-ink-2">
                  {fmt(extra.kcal)}
                  <span className="text-xs"> · {fmt(extra.protein)}p</span>
                </span>
                <button
                  type="button"
                  onClick={() => removeExtra(extra.id)}
                  aria-label={`Remove ${extra.label}`}
                  className="px-1 text-xl leading-none text-muted"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="h-14 w-full rounded-2xl border border-accent text-base font-semibold text-accent transition active:scale-[0.98]"
      >
        Add something else
      </button>

      <footer className="border-t border-grid pt-4 text-xs text-muted">
        Maintenance {fmt(MAINTENANCE_KCAL)} · target {fmt(KCAL_TARGET)} ·
        protein floor {PROTEIN_FLOOR_G} g
        <br />
        Uncheck anything you skip, then add what you ate instead. Everything
        here clears itself at midnight Eastern.
        <br />
        <button
          type="button"
          onClick={clearToday}
          className="mt-1 underline underline-offset-2"
        >
          Clear today
        </button>
      </footer>

      <AddFoodDialog ref={dialogRef} onAdd={addExtra} />
    </div>
  );
}

function Check({ on }: { on: boolean }) {
  return (
    <span
      className={`grid h-[22px] w-[22px] flex-none place-items-center rounded-md border transition ${
        on ? "border-accent bg-accent" : "border-axis"
      }`}
      aria-hidden
    >
      <svg
        viewBox="0 0 16 16"
        className={`h-3 w-3 transition ${on ? "opacity-100" : "opacity-0"}`}
        fill="none"
        stroke="white"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M2.5 8.5l3.5 3.5 7.5-8" />
      </svg>
    </span>
  );
}

function AddFoodDialog({
  ref,
  onAdd,
}: {
  ref: React.RefObject<HTMLDialogElement | null>;
  onAdd: (entry: Omit<Extra, "id">) => void;
}) {
  const [label, setLabel] = useState("");
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");

  const close = () => {
    ref.current?.close();
    setLabel("");
    setKcal("");
    setProtein("");
    setCarbs("");
    setFat("");
  };

  const addQuick = (quick: QuickItem) => {
    onAdd({
      label: quick.label,
      kcal: quick.kcal,
      protein: quick.protein,
      carbs: quick.carbs,
      fat: quick.fat,
    });
    close();
  };

  const addTyped = () => {
    const calories = Number(kcal);
    if (!Number.isFinite(calories) || calories <= 0) return;
    onAdd({
      label: label.trim() || "Extra",
      kcal: calories,
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fat: Number(fat) || 0,
    });
    close();
  };

  const field =
    "mt-1 h-11 w-full rounded-lg border border-grid bg-page px-3 text-base";

  return (
    <dialog
      ref={ref}
      onClose={close}
      className="m-auto max-h-[85dvh] w-[92vw] max-w-sm overflow-y-auto rounded-2xl bg-card p-0 text-ink backdrop:bg-black/50"
    >
      <div className="space-y-4 p-5">
        <div>
          <h2 className="text-lg font-semibold">Add food</h2>
          <p className="text-sm text-ink-2">
            Tap something you keep around, or type it in.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {QUICK_ADD.map((quick) => (
            <button
              key={quick.label}
              type="button"
              onClick={() => addQuick(quick)}
              className="rounded-lg border border-grid bg-page px-3 py-2 text-left text-[13px]"
            >
              <span className="font-medium">{quick.label}</span>{" "}
              <span className="tabular-nums text-muted">{quick.kcal}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="col-span-2 block text-xs font-medium text-ink-2">
            Name
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Two slices of pizza"
              className={field}
            />
          </label>
          <label className="block text-xs font-medium text-ink-2">
            Calories
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={kcal}
              onChange={(e) => setKcal(e.target.value)}
              placeholder="600"
              className={field}
            />
          </label>
          <label className="block text-xs font-medium text-ink-2">
            Protein g
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={protein}
              onChange={(e) => setProtein(e.target.value)}
              placeholder="24"
              className={field}
            />
          </label>
          <label className="block text-xs font-medium text-ink-2">
            Carbs g
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={carbs}
              onChange={(e) => setCarbs(e.target.value)}
              placeholder="70"
              className={field}
            />
          </label>
          <label className="block text-xs font-medium text-ink-2">
            Fat g
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={fat}
              onChange={(e) => setFat(e.target.value)}
              placeholder="24"
              className={field}
            />
          </label>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={close}
            className="h-12 flex-1 rounded-xl border border-grid text-sm font-semibold text-ink-2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={addTyped}
            disabled={!(Number(kcal) > 0)}
            className="h-12 flex-1 rounded-xl bg-accent text-sm font-semibold text-white disabled:opacity-60"
          >
            Add to today
          </button>
        </div>
      </div>
    </dialog>
  );
}
