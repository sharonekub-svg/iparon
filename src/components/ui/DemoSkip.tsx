'use client';

import { useTransition } from 'react';

import { signInAsDemo } from '@/app/(auth)/actions';

/**
 * "דלג" — כניסה לחשבון הדגמה בלחיצה אחת, בלי למלא כלום.
 * קיים כדי שאפשר יהיה לראות את הדשבורד וההעלאה בלי לפתוח חשבון.
 */
export function DemoSkip() {
  const [pending, start] = useTransition();

  return (
    <div className="border-line mt-6 border-t pt-6">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => void signInAsDemo())}
        className="border-line-input text-label text-ink hover:bg-surface-sunk w-full rounded-md border px-6 py-3.5 transition-colors disabled:opacity-50"
      >
        {pending ? 'רגע...' : 'דלג — אני רק רוצה להסתכל'}
      </button>
      <p className="text-meta text-ink-faint mt-2 text-center">
        כניסה לחשבון הדגמה, בלי הרשמה
      </p>
    </div>
  );
}
