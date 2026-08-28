'use client';

import { useState } from 'react';

/**
 * הכרטיסייה של דף הנחיתה.
 *
 * זו לא תמונת מוצר אלא המוצר עצמו: המבקר הופך כרטיסייה אמיתית לפני
 * שהוא נרשם. ההיפוך הוא ההבטחה של המוצר בשלוש שניות, ולכן הוא נמצא
 * בחלק העליון של המסך ולא מתחת לקיפול.
 */

const CARDS = [
  {
    front: 'איזה אנזים מפרק עמילן, והיכן הוא פועל?',
    back: 'עמילאז, ברוק שבחלל הפה. הוא מפרק עמילן לסוכרים פשוטים.',
  },
  {
    front: 'מה תפקיד חומצת המלח בקיבה?',
    back: 'היא מפעילה את פפסין, שמפרק חלבונים, והורגת חיידקים שהגיעו עם המזון.',
  },
  {
    front: 'היכן נספגים רוב אבות המזון?',
    back: 'במעי הדק, דרך הסיסים שמגדילים את שטח הפנים לספיגה.',
  },
];

export function HeroCard() {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const card = CARDS[index];

  function advance() {
    setFlipped(false);
    // ההיפוך חזרה נמשך חצי שנייה; מחליפים תוכן רק אחרי שהפנים חזרו
    window.setTimeout(() => setIndex((i) => (i + 1) % CARDS.length), 260);
  }

  return (
    <div className="w-full">
      <div className="flip-scene">
        <button
          type="button"
          onClick={() => setFlipped(!flipped)}
          aria-label={flipped ? 'הסתר את התשובה' : 'הצג את התשובה'}
          data-flipped={flipped}
          className="flip-card block h-60 w-full text-start"
        >
          <div className="flip-face border-line-strong bg-surface shadow-lift absolute inset-0 flex flex-col items-center justify-center rounded-2xl border px-6 pt-9 pb-12 text-center">
            <p className="text-meta text-ink-faint absolute inset-x-0 top-5 font-mono">
              ביולוגיה
            </p>
            <p className="text-heading text-ink text-balance">{card.front}</p>
            <p className="text-meta text-ink-faint absolute inset-x-0 bottom-5">
              הקש כדי לראות את התשובה
            </p>
          </div>

          <div className="flip-back bg-ink shadow-lift flex flex-col items-center justify-center rounded-2xl px-6 pt-9 pb-12 text-center">
            <p className="text-meta text-on-ink/45 absolute inset-x-0 top-5 font-mono">
              התשובה
            </p>
            <p className="text-heading text-on-ink text-balance">{card.back}</p>
            <p className="text-meta text-on-ink/45 absolute inset-x-0 bottom-5">
              הקש כדי לחזור לשאלה
            </p>
          </div>
        </button>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex gap-1.5" aria-hidden="true">
          {CARDS.map((item, i) => (
            <span
              key={item.front}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === index ? 'bg-ink w-6' : 'bg-line-strong w-2.5'
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={advance}
          className="text-meta text-ink-faint hover:text-ink tap"
        >
          כרטיסייה הבאה
        </button>
      </div>
    </div>
  );
}
