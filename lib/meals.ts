// The day's eating plan, and the browser-only storage behind it.
//
// Meals deliberately never reach Postgres. A day's checkboxes live in
// localStorage under an Eastern-time date key, so the moment the Eastern day
// rolls over the app reads a key that has nothing in it and the plan is
// unchecked again — refreshing the page mid-day keeps everything, opening it
// the next morning does not. Old keys are pruned on load, so nothing
// accumulates.
//
// This file is the one place to edit: targets, the planned items, and the
// quick-add list.

export const KCAL_TARGET = 1825;
export const PROTEIN_FLOOR_G = 140;
export const MAINTENANCE_KCAL = 2587;

// "EST" in practice means Eastern wall-clock time, which observes DST — this
// zone resets at midnight Eastern year-round rather than drifting an hour in
// summer.
export const MEAL_TZ = "America/New_York";

export type Nutrition = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type PlannedItem = Nutrition & { id: string; label: string };
export type MealSection = { name: string; items: PlannedItem[] };
export type QuickItem = Nutrition & { label: string };
// Anything added by hand during the day. `id` is local to the day, only used
// as a React key and for removal.
export type Extra = Nutrition & { id: string; label: string };

export type MealDay = { checked: string[]; extras: Extra[] };

const item = (
  id: string,
  label: string,
  kcal: number,
  protein: number,
  carbs: number,
  fat: number
): PlannedItem => ({ id, label, kcal, protein, carbs, fat });

export const MEAL_PLAN: MealSection[] = [
  {
    name: "Coffee",
    items: [
      item("cof", "Coffee or espresso", 5, 0, 1, 0),
      item("mlk", "Splash of milk", 66, 4, 5, 4),
      item("drz", "Caramel drizzle", 50, 0, 13, 0),
    ],
  },
  {
    name: "Breakfast",
    items: [
      item("egg", "2 eggs", 140, 12, 1, 10),
      item("brd", "2 slices bread", 140, 8, 26, 2),
      item("jam", "Jam", 50, 0, 12, 0),
      item("ccz", "Cream cheese", 100, 2, 4, 9),
      item("yo1", "Yogurt cup", 80, 12, 8, 0),
    ],
  },
  {
    name: "Lunch",
    items: [
      item("chk", "Half a chicken breast", 277, 55, 0, 4),
      item("swp", "Sweet potato", 100, 2, 23, 0),
      item("bro", "Broccoli", 14, 2, 3, 0),
    ],
  },
  {
    name: "Snack",
    items: [
      item("yo2", "Yogurt cup", 80, 12, 8, 0),
      item("nec", "Nectarine", 62, 1, 15, 1),
      item("ban", "Banana", 89, 1, 23, 0),
    ],
  },
  {
    name: "Post-lift",
    items: [item("wh1", "Scoop of whey", 120, 24, 4, 2)],
  },
  {
    name: "Dinner",
    items: [
      item("wh2", "Whey in water", 120, 24, 4, 2),
      item("tst", "2 slices toast", 140, 8, 26, 2),
      item("pnb", "Peanut butter, 2 tbsp", 190, 8, 7, 16),
    ],
  },
];

export const QUICK_ADD: QuickItem[] = [
  { label: "Scoop of whey", kcal: 120, protein: 24, carbs: 4, fat: 2 },
  { label: "Yogurt cup", kcal: 80, protein: 12, carbs: 8, fat: 0 },
  { label: "Peanut butter, 1 tbsp", kcal: 95, protein: 4, carbs: 4, fat: 8 },
  { label: "Banana", kcal: 89, protein: 1, carbs: 23, fat: 0 },
  { label: "Egg", kcal: 65, protein: 6, carbs: 1, fat: 5 },
  { label: "Slice of bread", kcal: 70, protein: 4, carbs: 13, fat: 1 },
  { label: "Sweet potato", kcal: 100, protein: 2, carbs: 23, fat: 0 },
  { label: "Olive oil, 1 tbsp", kcal: 120, protein: 0, carbs: 0, fat: 14 },
  { label: "Bowl of lentil soup", kcal: 400, protein: 18, carbs: 55, fat: 12 },
  { label: "Half a chicken breast", kcal: 277, protein: 55, carbs: 0, fat: 6 },
];

const PLANNED_BY_ID = new Map(
  MEAL_PLAN.flatMap((section) => section.items).map((entry) => [entry.id, entry])
);

export function totals(checked: Set<string>, extras: Extra[]): Nutrition {
  const sum: Nutrition = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const add = (n: Nutrition) => {
    sum.kcal += n.kcal;
    sum.protein += n.protein;
    sum.carbs += n.carbs;
    sum.fat += n.fat;
  };
  for (const id of checked) {
    const entry = PLANNED_BY_ID.get(id);
    if (entry) add(entry);
  }
  for (const extra of extras) add(extra);
  return sum;
}

export function sectionKcal(section: MealSection, checked: Set<string>): number {
  return section.items.reduce(
    (acc, entry) => acc + (checked.has(entry.id) ? entry.kcal : 0),
    0
  );
}

// ---------------------------------------------------------------- the day

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: MEAL_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// "2026-09-03" for the Eastern date, whatever timezone the phone is in.
export function easternDay(at: Date = new Date()): string {
  return dayFormatter.format(at);
}

const headingFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: MEAL_TZ,
  weekday: "long",
  month: "short",
  day: "numeric",
});

export function easternDayHeading(at: Date = new Date()): string {
  return headingFormatter.format(at);
}

// ------------------------------------------------------------- storage

const PREFIX = "medtrack:meals:";
const EMPTY: MealDay = { checked: [], extras: [] };

// Every one of these swallows failures: storage can be unavailable (private
// mode, storage disabled) and the tracker should still work for the session.
export function loadMealDay(day: string): MealDay {
  try {
    const raw = window.localStorage.getItem(PREFIX + day);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<MealDay>;
    return {
      checked: Array.isArray(parsed.checked) ? parsed.checked : [],
      extras: Array.isArray(parsed.extras) ? parsed.extras : [],
    };
  } catch {
    return EMPTY;
  }
}

export function saveMealDay(day: string, data: MealDay): void {
  try {
    window.localStorage.setItem(PREFIX + day, JSON.stringify(data));
  } catch {
    // Nothing to do: the day just won't survive a refresh.
  }
}

// Yesterday's checkboxes are not history, they're litter. Drop every meal key
// that isn't the day being shown.
export function pruneOtherDays(day: string): void {
  try {
    const stale: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(PREFIX) && key !== PREFIX + day) stale.push(key);
    }
    for (const key of stale) window.localStorage.removeItem(key);
  } catch {
    // Ignore: pruning is housekeeping, not correctness.
  }
}

export function newExtraId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `x${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  }
}
