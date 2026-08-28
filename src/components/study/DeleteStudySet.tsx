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
        className="text-meta text-ink-faint hover:text-wrong tap -ms-3 inline-flex min-h-11 items-center rounded-lg px-3"
      >
        מחיקת החומר
      </button>
    );
  }

  return (
    <div className="border-line-strong bg-surface flex flex-col gap-3 rounded-xl border px-4 py-4">
      <p className="text-small text-ink">
        למחוק את החומר? הסיכום, הכרטיסיות, השאלות והתוצאות יימחקו איתו.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => start(() => void deleteStudySet(studySetId))}
          className="bg-wrong text-label tap min-h-11 rounded-lg px-5 text-white disabled:opacity-50"
        >
          {pending ? 'מוחק...' : 'כן, מחק'}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming(false)}
          className="border-line-input text-label text-ink hover:bg-surface-sunk tap min-h-11 rounded-lg border px-5"
        >
          ביטול
        </button>
      </div>
    </div>
  );
}
