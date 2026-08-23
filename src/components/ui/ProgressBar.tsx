export function ProgressBar({ value, max }: { value: number; max: number }) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;

  return (
    <div
      className="bg-track h-1 overflow-hidden rounded-full"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label="התקדמות"
    >
      <div
        className="bg-ink h-full transition-[width] duration-300"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
