'use client';

import { useState } from 'react';

import { rateFlashcard } from '@/app/(app)/sets/[id]/actions';
import { IconArrow } from '@/components/ui/IconArrow';
import { ProgressBar } from '@/components/ui/ProgressBar';
import type { Flashcard } from '@/lib/study';

/**
 * כרטיסייה אחת במסך. הקשה חושפת את התשובה, ואז התלמיד מדרג.
 * הדירוג נשמר ומזין את חישוב השליטה. בלי חזרות מרווחות — הספק
 * מבקש במפורש לא לבנות אלגוריתם מסובך ב-V1.
 */

const RATINGS = [
  { value: 0, label: 'לא ידעתי' },
  { value: 1, label: 'כמעט' },
  { value: 2, label: 'ידעתי' },
] as const;

export function FlashcardDeck({
  cards,
  persistRatings = true,
}: {
  cards: Flashcard[];
  /** בדמו הציבורי אין משתמש מחובר, ולכן אין מה לשמור. */
  persistRatings?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** הדירוגים בסבב הנוכחי, לסיכום בסוף */
  const [given, setGiven] = useState<Record<string, number>>({});

  const card = cards[index];
  const done = index >= cards.length;

  async function rate(value: number) {
    setSaving(true);
    setError(null);

    if (persistRatings) {
      const result = await rateFlashcard(card.id, value);
      if (!result.ok) {
        setError(result.error);
        setSaving(false);
        return;
      }
    }

    setGiven((prev) => ({ ...prev, [card.id]: value }));
    setIndex(index + 1);
    setRevealed(false);
    setSaving(false);
  }

  function back() {
    if (index === 0) return;
    setIndex(index - 1);
    // חוזרים לכרטיסייה קודמת עם התשובה חשופה — היא כבר נראתה
    setRevealed(true);
    setError(null);
  }

  function restart() {
    setIndex(0);
    setRevealed(false);
    setGiven({});
    setError(null);
  }

  if (done) {
    const counts = { 0: 0, 1: 0, 2: 0 } as Record<number, number>;
    for (const value of Object.values(given)) counts[value] += 1;
    const shaky = counts[0] + counts[1];

    return (
      <div className="border-line rounded-lg border px-5 py-8 text-center">
        <p className="text-subheading text-ink">סיימת את הסיבוב</p>

        <div className="mt-5 flex justify-center gap-6">
          {RATINGS.map((rating) => (
            <div key={rating.value}>
              <p className="num text-heading text-ink">{counts[rating.value]}</p>
              <p className="text-meta text-ink-faint mt-0.5">{rating.label}</p>
            </div>
          ))}
        </div>

        <p className="text-small text-ink-body mt-5">
          {shaky === 0
            ? 'ידעת הכול. אפשר לעבור לתרגול.'
            : `${shaky === 1 ? 'כרטיסייה אחת' : `${shaky} כרטיסיות`} עוד לא יושבות. עוד סיבוב יעזור.`}
        </p>

        <button
          type="button"
          onClick={restart}
          className="border-line-input text-label text-ink hover:bg-surface-sunk mt-5 rounded-md border px-5 py-2.5"
        >
          עוד סיבוב
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="num text-meta text-ink-faint font-mono">
          {index + 1} / {cards.length}
        </p>
        <button
          type="button"
          onClick={back}
          disabled={index === 0}
          className="text-meta text-ink-faint hover:text-ink inline-flex items-center gap-1 transition-colors disabled:opacity-0"
        >
          <IconArrow direction="back" className="size-3.5" />
          הקודמת
        </button>
      </div>

      <div className="mt-2">
        <ProgressBar value={index} max={cards.length} />
      </div>

      <button
        type="button"
        onClick={() => setRevealed(true)}
        disabled={revealed}
        className="border-line-strong bg-surface mt-5 flex min-h-56 w-full flex-col justify-center gap-4 rounded-xl border px-6 py-8 text-start disabled:cursor-default"
      >
        <p className="text-subheading text-ink">{card.front}</p>
        {revealed ? (
          <p className="text-body text-ink-body border-line border-t pt-4">{card.back}</p>
        ) : (
          <p className="text-meta text-ink-faint">הקש כדי לראות את התשובה</p>
        )}
      </button>

      {error ? (
        <p
          role="alert"
          className="text-small bg-wrong-soft text-wrong mt-4 rounded-md px-4 py-3"
        >
          {error}
        </p>
      ) : null}

      {revealed ? (
        <div className="mt-4 flex gap-2">
          {RATINGS.map((rating) => (
            <button
              key={rating.value}
              type="button"
              disabled={saving}
              onClick={() => rate(rating.value)}
              className="border-line-input text-label text-ink hover:bg-surface-sunk flex-1 rounded-md border px-2 py-3.5 transition-colors disabled:opacity-50"
            >
              {rating.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
