/**
 * שלד טעינה.
 *
 * Next מציג את loading.tsx בזמן שה-Server Component נטען. בלעדיו
 * לחיצה על טאב ברשת סלולרית לא מציגה כלום למשך שנייה ויותר, והמסך
 * נראה תקוע. שלד שמזכיר את צורת התוכן האמיתי מרגיש מהיר יותר
 * מסתובב טעינה, גם כשהזמן זהה.
 */
export function SkeletonLine({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`bg-track h-4 animate-pulse rounded-sm ${className}`}
    />
  );
}

export function SkeletonBlock({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`bg-track animate-pulse rounded-lg ${className}`}
    />
  );
}

/** מכריז לקוראי מסך שהתוכן בטעינה, בלי להקריא את השלד עצמו */
export function LoadingRegion({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">טוען…</span>
      {children}
    </div>
  );
}
