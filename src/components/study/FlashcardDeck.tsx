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
 *
 * **הסיבוב השני הוא רק מה שלא ידעת.** כרטיסייה שדורגה "ידעתי" יורדת
 * מהחפיסה ולא חוזרת, ומה שנשאר ("לא ידעתי" ו"כמעט") רץ שוב — סיבוב
 * אחרי סיבוב, עד שלא נשאר כלום. זו החזרה עצמה, לא אלגוריתם: החפיסה
 * מתקצרת עד שהיא נגמרת.
 */

const RATINGS = [
  { value: 0, label: 'לא ידעתי' },
  { value: 1, label: 'כמעט' },
  { value: 2, label: 'ידעתי' },
] as const;

/** ידעתי = יורדת מהחפיסה. כל דירוג אחר חוזר בסיבוב הבא. */
const KNOWN = 2;

export function FlashcardDeck({
  cards,
  persistRatings = true,
}: {
  cards: Flashcard[];
  /** בדמו הציבורי אין משתמש מחובר, ולכן אין מה לשמור. */
  persistRatings?: boolean;
}) {
  /** החפיסה של הסיבוב הנוכחי — בסיבוב הראשון הכול, אחר כך רק מה שלא ידע */
  const [deck, setDeck] = useState<Flashcard[]>(cards);
  const [round, setRound] = useState(1);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** הדירוגים בסבב הנוכחי, לסיכום בסוף */
  const [given, setGiven] = useState<Record<string, number>>({});

  const card = deck[index];
  const done = index >= deck.length;

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

  /** סיבוב חדש על חפיסה נתונה. `next` ריק לעולם לא מגיע לכאן. */
  function play(next: Flashcard[], nextRound: number) {
    setDeck(next);
    setRound(nextRound);
    setIndex(0);
    setRevealed(false);
    setGiven({});
    setError(null);
  }

  if (done) {
    const counts = { 0: 0, 1: 0, 2: 0 } as Record<number, number>;
    for (const value of Object.values(given)) counts[value] += 1;
    // מה שלא ידע בסיבוב הזה — בסדר שבו הופיע, כדי שהחזרה לא תרגיש אקראית
    const again = deck.filter((c) => (given[c.id] ?? 0) < KNOWN);

    return (
      <div className="rise bg-ink shadow-lift rounded-2xl px-5 py-12 text-center">
        <p className="text-heading text-on-ink">
          {again.length === 0 ? 'ידעת הכול' : 'סיימת את הסיבוב'}
        </p>

        <div className="mt-8 flex justify-center gap-8">
          {RATINGS.map((rating) => (
            <div key={rating.value}>
              <p className="num text-display text-on-ink">{counts[rating.value]}</p>
              <p className="text-meta text-on-ink/50 mt-1">{rating.label}</p>
            </div>
          ))}
        </div>

        <p className="text-small text-on-ink/70 mx-auto mt-8 max-w-xs text-balance">
          {again.length === 0
            ? 'החפיסה נגמרה — כל כרטיסייה סומנה "ידעתי". אפשר לעבור לתרגול.'
            : `${again.length === 1 ? 'כרטיסייה אחת' : `${again.length} כרטיסיות`} עוד לא יושבות. הסיבוב הבא הוא רק הן — מה שידעת לא יחזור.`}
        </p>

        <div className="mt-7 flex flex-col items-center gap-3">
          {again.length > 0 ? (
            <button
              type="button"
              onClick={() => play(again, round + 1)}
              className="bg-on-ink text-label text-ink tap rounded-lg px-6 py-3.5 hover:opacity-90"
            >
              חזרה על מה שלא ידעת (<span className="num">{again.length}</span>)
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => play(cards, 1)}
            className={
              again.length > 0
                ? 'text-meta text-on-ink/60 hover:text-on-ink tap min-h-11 rounded-lg px-4 underline underline-offset-4'
                : 'bg-on-ink text-label text-ink tap rounded-lg px-6 py-3.5 hover:opacity-90'
            }
          >
            הכול מהתחלה (<span className="num">{cards.length}</span>)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-meta text-ink-faint truncate">
          <span className="num font-mono">
            {index + 1} / {deck.length}
          </span>
          {round > 1 ? (
            <>
              {' · סיבוב '}
              <span className="num">{round}</span>
              {', מה שלא ידעת'}
            </>
          ) : null}
        </p>
        <button
          type="button"
          onClick={back}
          disabled={index === 0}
          className="text-meta text-ink-faint hover:text-ink tap -me-3 inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-3 disabled:opacity-0"
        >
          <IconArrow direction="back" className="size-3.5" />
          הקודמת
        </button>
      </div>

      <div className="mt-2">
        <ProgressBar value={index} max={deck.length} />
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
