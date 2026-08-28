/**
 * וי ואיקס כ-SVG. תווים כמו ✓ תלויים בפונט המערכת ומשתנים בין מכשירים,
 * והצורה כאן היא חלק מהמשוב ולא קישוט.
 */
export function IconMark({
  kind,
  className = '',
}: {
  kind: 'check' | 'cross';
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {kind === 'check' ? <path d="m3.5 8.5 3 3 6-7" /> : <path d="m4 4 8 8M12 4l-8 8" />}
    </svg>
  );
}
