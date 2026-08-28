/**
 * דף עם פלוס. הכפתור הזה הוא נקודת הכניסה היחידה למוצר, ולכן הוא
 * מקבל אייקון ולא סימן חיבור בודד.
 */
export function IconAddPage({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`border-line-strong flex size-11 items-center justify-center rounded-xl border ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 3H7.5A1.5 1.5 0 0 0 6 4.5v15A1.5 1.5 0 0 0 7.5 21h9a1.5 1.5 0 0 0 1.5-1.5V7z" />
        <path d="M14 3v4.5H18" />
        <path d="M12 11.5v6M9 14.5h6" />
      </svg>
    </span>
  );
}
