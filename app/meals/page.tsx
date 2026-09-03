import MealTracker from "@/components/MealTracker";

export const metadata = { title: "Meals — MedTrack" };

export default function MealsPage() {
  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Meals</h1>
        <p className="text-sm text-ink-2">
          Check off what you actually ate. Resets at midnight Eastern — nothing
          is saved beyond today.
        </p>
      </header>
      <MealTracker />
    </main>
  );
}
