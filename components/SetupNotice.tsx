export default function SetupNotice({ message }: { message: string }) {
  return (
    <div className="rounded-[20px] border border-danger/40 bg-card p-[18px] text-[13.5px] text-ink-2">
      <p className="eyebrow mb-1.5 text-danger">Database not ready</p>
      <p>{message}</p>
    </div>
  );
}
