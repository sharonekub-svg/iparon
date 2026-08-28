'use client';

import { useState, useTransition } from 'react';

import { deleteStudySet } from '@/app/(app)/sets/[id]/actions';

/**
 * מחיקת חומר. שני שלבים בכוונה — מחיקה מוחקת גם את הסיכום,
 * הכרטיסיות, השאלות והניסיונות, וזו פעולה שאין ממנה חזרה.
 */
export function DeleteStudySet({ studySetId }: { studySetId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-meta text-ink-faint hover:text-wrong transition-colors"
      >
        מחיקת החומר
      </button>
    );
  }

  return (
    <div className="border-line flex flex-col gap-3 rounded-md border px-4 py-3.5">
      <p className="text-small text-ink">
        למחוק את החומר? הסיכום, הכרטיסיות, השאלות והתוצאות יימחקו איתו.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => start(() => void deleteStudySet(studySetId))}
          className="bg-wrong text-label rounded-md px-4 py-2.5 text-white disabled:opacity-50"
        >
          {pending ? 'מוחק...' : 'כן, מחק'}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming(false)}
          className="border-line-input text-label text-ink hover:bg-surface-sunk rounded-md border px-4 py-2.5"
        >
          ביטול
        </button>
      </div>
    </div>
  );
}
