'use client';

import { useMemo, useState } from 'react';

import { Quiz } from './Quiz';
import { ScopePicker } from './ScopePicker';

import type { Question } from '@/lib/study';

/**
 * בחירת היקף התרגול.
 *
 * לפני מבחן על שני פרקים התלמיד רוצה לתרגל בדיוק את שניהם — לא נושא
 * אחד ולא את כל מה שהעלה אי־פעם. הסינון נעשה בלקוח כי שאלות התרגול
 * ממילא מגיעות במלואן: בקוויז המשוב מיידי, וגם התשובה הנכונה כבר כאן.
 *
 * כשיש נושא אחד בלבד אין מה לבחור, והמסך קופץ ישר לשאלות.
 */
export function QuizSetup({
  questions,
  studySetId,
}: {
  questions: Question[];
  studySetId?: string;
}) {
  const topics = useMemo(() => {
    const counts = new Map<string, number>();
    for (const q of questions) {
      if (q.topic) counts.set(q.topic, (counts.get(q.topic) ?? 0) + 1);
    }
    return [...counts].map(([name, available]) => ({ id: name, name, available }));
  }, [questions]);

  const [selected, setSelected] = useState<string[]>(topics.map((t) => t.id));
  const [started, setStarted] = useState(topics.length < 2);

  const everything = selected.length === topics.length;
  // "הכול" כולל גם שאלות שלא שויכו לנושא; בחירה חלקית לא
  const chosen = everything
    ? questions
    : questions.filter((q) => q.topic && selected.includes(q.topic));

  if (started) {
    return (
      <div>
        {topics.length >= 2 ? (
          <div className="mb-5 flex items-center justify-between gap-3">
            <p className="text-meta text-ink-faint truncate">
              {everything ? 'מתרגל על כל החומר' : `מתרגל על ${selected.join(' · ')}`}
            </p>
            <button
              type="button"
              onClick={() => setStarted(false)}
              className="text-meta text-ink-faint hover:text-ink tap shrink-0 underline underline-offset-4"
            >
              שנה היקף
            </button>
          </div>
        ) : null}

        {/* key מאפס את הקוויז כשההיקף משתנה, כדי שלא יישאר מדד ישן */}
        <Quiz key={selected.join('|')} questions={chosen} studySetId={studySetId} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <ScopePicker
        title="על מה לתרגל?"
        items={topics}
        selected={selected}
        onChange={setSelected}
      />

      <button
        type="button"
        onClick={() => setStarted(true)}
        className="bg-ink text-on-ink text-label tap rounded-lg px-6 py-4 hover:opacity-90"
      >
        התחל תרגול (<span className="num">{chosen.length}</span> שאלות)
      </button>

      <p className="text-meta text-ink-faint">
        בתרגול המשוב מיידי: אחרי כל בחירה רואים אם צדקת ולמה.
      </p>
    </div>
  );
}
