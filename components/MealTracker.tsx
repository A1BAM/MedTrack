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
      <section className="rounded-[20px] border border-grid bg-card p-5">
        <div className="flex items-baseline justify-between">
          <span className="eyebrow" suppressHydrationWarning>{heading || "Today"}</span>
          <span className="eyebrow text-accent">
            {t.kcal === 0
              ? "nothing logged yet"
              : `${(deficit / 500).toFixed(1)} lb/wk at this pace`}
          </span>
        </div>

        <div className="mt-3.5 flex items-end gap-3.5">
          <span
            className={`num text-[62px] leading-[0.85] ${
              over ? "text-danger" : "text-accent"
            }`}
          >
            {fmt(Math.abs(left))}
          </span>
          <span className="pb-1 text-sm">
            <span className="block text-[14.5px]">
              calories {over ? "over" : "left"}
            </span>
            <span className="block text-[13px] text-ink-2">
              <span className="num">{fmt(t.kcal)}</span> of{" "}
              <span className="num">{fmt(KCAL_TARGET)}</span> eaten
            </span>
          </span>
        </div>

        <div className="mt-4.5 border-t border-grid pt-3.5">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-[14px]">Protein</span>
            <span className="num text-[14px] text-ink-2">
              {fmt(t.protein)} of {PROTEIN_FLOOR_G} g
            </span>
          </div>
          <div
            className="mt-2.5 h-[5px] overflow-hidden rounded-full bg-grid"
            role="progressbar"
            aria-label="Protein against the daily floor"
            aria-valuemin={0}
            aria-valuemax={PROTEIN_FLOOR_G}
            aria-valuenow={Math.round(t.protein)}
          >
            <div
              className={`h-full rounded-full transition-[width] duration-300 ${
                proteinDone ? "bg-good" : "bg-axis"
              }`}
              style={{ width: `${proteinPct}%` }}
            />
          </div>
          <p
            className={`mt-2.5 text-xs ${proteinDone ? "text-good" : "text-muted"}`}
          >
            {proteinDone
              ? "Cleared. Anything above this is free."
              : `${fmt(PROTEIN_FLOOR_G - t.protein)} g to go. This is a floor, not a cap.`}
          </p>
        </div>

        <div className="mt-3.5 flex gap-5.5 border-t border-grid pt-3.5 text-xs text-muted">
          <span>
            Carbs <b className="num text-[15px] font-normal text-ink">{fmt(t.carbs)}</b>g
          </span>
          <span>
            Fat <b className="num text-[15px] font-normal text-ink">{fmt(t.fat)}</b>g
          </span>
          <span>
            Deficit{" "}
            <b className="num text-[15px] font-normal text-ink">{fmt(deficit)}</b>
          </span>
        </div>
      </section>

      {MEAL_PLAN.map((section) => {
        const sub = sectionKcal(section, checked);
        return (
          <section key={section.name}>
            <div className="flex items-baseline justify-between border-b border-axis pb-2.5">
              <h2 className="eyebrow">{section.name}</h2>
              <span
                className={`num text-[12.5px] ${sub ? "text-accent" : "text-muted"}`}
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
                      className="flex h-[52px] w-full items-center gap-3.5 text-left"
                    >
                      <Check on={on} />
                      <span className={`flex-1 text-[15px] ${on ? "text-ink-2" : ""}`}>
                        {entry.label}
                      </span>
                      <span
                        className={`num text-[15px] ${on ? "text-ink-2" : "text-ink"}`}
                      >
                        {fmt(entry.kcal)}
                        <span className="text-[12.5px] text-muted"> · {fmt(entry.protein)}p</span>
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
          <div className="flex items-baseline justify-between border-b border-axis pb-2.5">
            <h2 className="eyebrow">Added</h2>
            <span className="num text-[12.5px] text-accent">
              {fmt(extras.reduce((acc, extra) => acc + extra.kcal, 0))} kcal
            </span>
          </div>
          <ul>
            {extras.map((extra) => (
              <li
                key={extra.id}
                className="flex h-[52px] items-center gap-3.5 border-b border-grid last:border-0"
              >
                <Check on />
                <span className="flex-1 text-[15px] text-ink-2">
                  {extra.label}
                </span>
                <span className="num text-[15px] text-ink-2">
                  {fmt(extra.kcal)}
                  <span className="text-[12.5px] text-muted"> · {fmt(extra.protein)}p</span>
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
        className="h-[54px] w-full rounded-[18px] border border-accent text-[15px] font-medium text-accent transition active:scale-[0.98]"
      >
        Add something else
      </button>

      <footer className="border-t border-grid pt-4 text-xs leading-relaxed text-muted">
        Maintenance {fmt(MAINTENANCE_KCAL)} · target {fmt(KCAL_TARGET)} ·
        protein floor {PROTEIN_FLOOR_G} g
        <br />
        Uncheck anything you skip, then add what you ate instead. Everything
        here clears itself at midnight.
        <br />
        <button
          type="button"
          onClick={clearToday}
          className="mt-1.5 underline decoration-axis underline-offset-[3px]"
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
      className={`grid h-[21px] w-[21px] flex-none place-items-center rounded-[7px] border-[1.5px] transition ${
        on ? "border-accent bg-accent" : "border-axis"
      }`}
      aria-hidden
    >
      <svg
        viewBox="0 0 16 16"
        className={`h-3 w-3 transition ${on ? "opacity-100" : "opacity-0"}`}
        fill="none"
        stroke="var(--on-accent)"
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
    "mt-1.5 h-11 w-full rounded-[14px] border border-grid bg-page px-3.5 text-base";

  return (
    <dialog
      ref={ref}
      onClose={close}
      className="m-auto max-h-[85dvh] w-[92vw] max-w-sm overflow-y-auto rounded-[22px] bg-card p-0 text-ink backdrop:bg-black/50"
    >
      <div className="space-y-4 p-5">
        <div>
          <h2 className="screen-title text-[22px]">Add food</h2>
          <p className="text-[13.5px] text-ink-2">
            Tap something you keep around, or type it in.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {QUICK_ADD.map((quick) => (
            <button
              key={quick.label}
              type="button"
              onClick={() => addQuick(quick)}
              className="rounded-[12px] border border-grid bg-page px-3 py-2.5 text-left text-[13px]"
            >
              <span className="font-medium">{quick.label}</span>{" "}
              <span className="num text-muted">{quick.kcal}</span>
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
            className="h-12 flex-1 rounded-[16px] border border-grid text-sm font-medium text-ink-2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={addTyped}
            disabled={!(Number(kcal) > 0)}
            className="h-12 flex-1 rounded-[16px] bg-accent text-sm font-medium text-on-accent disabled:opacity-60"
          >
            Add to today
          </button>
        </div>
      </div>
    </dialog>
  );
}
