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
      <div className="rise bg-ink shadow-lift rounded-2xl px-5 py-12 text-center">
        <p className="text-heading text-on-ink">סיימת את הסיבוב</p>

        <div className="mt-8 flex justify-center gap-8">
          {RATINGS.map((rating) => (
            <div key={rating.value}>
              <p className="num text-display text-on-ink">{counts[rating.value]}</p>
              <p className="text-meta text-on-ink/50 mt-1">{rating.label}</p>
            </div>
          ))}
        </div>

        <p className="text-small text-on-ink/70 mx-auto mt-8 max-w-xs text-balance">
          {shaky === 0
            ? 'ידעת הכול. אפשר לעבור לתרגול.'
            : `${shaky === 1 ? 'כרטיסייה אחת' : `${shaky} כרטיסיות`} עוד לא יושבות. עוד סיבוב יעזור.`}
        </p>

        <button
          type="button"
          onClick={restart}
          className="bg-on-ink text-label text-ink tap mt-7 rounded-lg px-6 py-3.5 hover:opacity-90"
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

      {/*
        סצנת ההיפוך. הכפתור עוטף את שתי הפאות, כך שהקשה בכל מקום
        על הכרטיסייה הופכת אותה — ולא רק על אזור קטן.
      */}
      <div className="flip-scene mt-5">
        <button
          type="button"
          onClick={() => setRevealed(!revealed)}
          aria-label={revealed ? 'הסתר את התשובה' : 'הצג את התשובה'}
          data-flipped={revealed}
          className="flip-card block h-72 w-full text-start"
        >
          {/* פנים — השאלה */}
          <div className="flip-face border-line-strong bg-surface shadow-card absolute inset-0 flex flex-col items-center justify-center overflow-hidden rounded-2xl border px-6 pt-11 pb-12 text-center">
            <p className="text-meta text-ink-faint absolute inset-x-0 top-5">שאלה</p>
            <p className="text-heading text-ink text-balance">{card.front}</p>
            <p className="text-meta text-ink-faint absolute inset-x-0 bottom-5">
              הקש כדי לראות את התשובה
            </p>
          </div>

          {/*
            גב — התשובה. ירוק ולא שחור: הירוק הוא צבע ה"נכון" במערכת,
            והתלמיד מזהה במבט אחד שהוא מסתכל על תשובה ולא על שאלה.
          */}
          <div className="flip-back bg-answer shadow-lift flex flex-col items-center justify-center overflow-hidden rounded-2xl px-6 pt-11 pb-12 text-center">
            <p className="text-meta text-on-ink/60 absolute inset-x-0 top-5">התשובה</p>
            <p className="text-subheading text-on-ink text-balance">{card.back}</p>
            <p className="text-meta text-on-ink/55 absolute inset-x-0 bottom-5 truncate px-6">
              {card.front}
            </p>
          </div>
        </button>
      </div>

      {error ? (
        <p
          role="alert"
          className="text-small bg-wrong-soft text-wrong mt-4 rounded-md px-4 py-3"
        >
          {error}
        </p>
      ) : null}

      {revealed ? (
        <div className="rise mt-4 flex gap-2">
          {RATINGS.map((rating) => (
            <button
              key={rating.value}
              type="button"
              disabled={saving}
              onClick={() => rate(rating.value)}
              className="border-line-input text-label text-ink hover:border-ink hover:bg-surface tap flex-1 rounded-xl border px-2 py-4 disabled:opacity-50"
            >
              {rating.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
