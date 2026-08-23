/**
 * חץ מצויר ולא תו. תווים כמו ‹ הם bidi-mirrored ומתהפכים לבד לפי
 * כיוון הפסקה, ואז הכפתור מצביע לכיוון ההפוך.
 */
export function IconArrow({
  direction,
  className = '',
}: {
  direction: 'forward' | 'back';
  className?: string;
}) {
  // ב-RTL "קדימה" הוא שמאלה
  const path = direction === 'forward' ? 'M10 3 5 8l5 5' : 'M6 3l5 5-5 5';

  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={`size-4 shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  );
}
