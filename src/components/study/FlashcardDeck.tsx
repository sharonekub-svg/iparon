'use client';

import { useState } from 'react';

import { createBrowserSupabase } from '@/lib/supabase/browser';
import type { Flashcard } from '@/lib/study';

/**
 * כרטיסייה אחת במסך. הקשה חושפת את התשובה, ואז התלמיד מדרג.
 * הדירוג נשמר ומזין את המאסטרי. בלי חזרות מרווחות בגרסה הזאת —
 * הספק מבקש במפורש לא לבנות אלגוריתם מסובך ב-V1.
 */

const ratings = [
  { value: 0, label: 'לא ידעתי' },
  { value: 1, label: 'כמעט ידעתי' },
  { value: 2, label: 'קל' },
] as const;

export function FlashcardDeck({ cards }: { cards: Flashcard[] }) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(false);

  const card = cards[index];

  async function rate(value: number) {
    // נשמר ברקע. תלמיד שמדפדף מהר לא צריך לחכות לרשת בין כרטיסיות,
    // ודירוג שאבד הוא הפסד זניח מול כרטיסייה שנתקעת.
    const supabase = createBrowserSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      void supabase
        .from('flashcard_reviews')
        .insert({ user_id: user.id, flashcard_id: card.id, rating: value });
    }

    if (index + 1 >= cards.length) {
      setDone(true);
    } else {
      setIndex(index + 1);
      setRevealed(false);
    }
  }

  if (done) {
    return (
      <div className="border-line rounded-lg border px-5 py-8 text-center">
        <p className="text-subheading text-ink">סיימת את הכרטיסיות</p>
        <p className="text-small text-ink-body mt-2">
          עברת על <span className="num">{cards.length}</span> כרטיסיות.
        </p>
        <button
          type="button"
          onClick={() => {
            setIndex(0);
            setRevealed(false);
            setDone(false);
          }}
          className="border-line-input text-label text-ink hover:bg-surface-sunk mt-5 rounded-md border px-5 py-2.5"
        >
          עוד סיבוב
        </button>
      </div>
    );
  }

  return (
    <div>
      <p className="text-meta text-ink-faint font-mono">
        <span className="num">{index + 1}</span> /{' '}
        <span className="num">{cards.length}</span>
      </p>

      <button
        type="button"
        onClick={() => setRevealed(true)}
        disabled={revealed}
        className="border-line-strong bg-surface mt-3 flex min-h-52 w-full flex-col justify-center gap-4 rounded-xl border px-6 py-8 text-start"
      >
        <p className="text-subheading text-ink">{card.front}</p>
        {revealed ? (
          <p className="text-body text-ink-body border-line border-t pt-4">{card.back}</p>
        ) : (
          <p className="text-meta text-ink-faint">הקש כדי לראות את התשובה</p>
        )}
      </button>

      {revealed ? (
        <div className="mt-4 flex gap-2">
          {ratings.map((rating) => (
            <button
              key={rating.value}
              type="button"
              onClick={() => rate(rating.value)}
              className="border-line-input text-label text-ink hover:bg-surface-sunk flex-1 rounded-md border px-2 py-3 transition-colors"
            >
              {rating.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
