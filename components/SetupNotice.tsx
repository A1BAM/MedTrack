export default function SetupNotice({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200">
      <p className="mb-1 font-semibold">Database not ready</p>
      <p>{message}</p>
    </div>
  );
}
