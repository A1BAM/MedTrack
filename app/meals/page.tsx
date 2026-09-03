import MealTracker from "@/components/MealTracker";

export const metadata = { title: "Meals — MedTrack" };

export default function MealsPage() {
  return (
    <main className="space-y-7">
      <header className="space-y-1.5">
        <h1 className="screen-title">Meals</h1>
        <p className="text-[13.5px] leading-relaxed text-ink-2">
          Check off what you actually ate. Resets at midnight — nothing
          is saved beyond today.
        </p>
      </header>
      <MealTracker />
    </main>
  );
}
