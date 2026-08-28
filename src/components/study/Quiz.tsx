'use client';

import { useState } from 'react';

import { recordQuizAttempt } from '@/app/(app)/sets/[id]/actions';
import { ProgressBar } from '@/components/ui/ProgressBar';
import type { Question } from '@/lib/study';

/**
 * שאלה אחת במסך, משוב מיד אחרי הבחירה.
 *
 * בקוויז התשובות הנכונות מגיעות ללקוח בכוונה: זה כלי לימוד, והמשוב
 * המיידי שווה יותר מההגנה — הרמאות היחידה האפשרית היא בתלמיד עם עצמו.
 * במבחן זה הפוך, והניקוד נעשה בשרת.
 */
export function Quiz({
  questions,
  studySetId,
}: {
  questions: Question[];
  /** בדמו הציבורי אין חומר ואין משתמש, ולכן אין מה לשמור. */
  studySetId?: string;
}) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);
  /** נאסף כדי לשמור את הניסיון בסוף — הנכונות נקבעת בשרת, לא כאן */
  const [answers, setAnswers] = useState<
    { question_id: string; selected_index: number }[]
  >([]);

  const question = questions[index];
  const answered = selected !== null;

  function choose(option: number) {
    if (answered) return;
    setSelected(option);
    setAnswers((prev) => [...prev, { question_id: question.id, selected_index: option }]);
    if (option === question.correct_index) setCorrectCount((c) => c + 1);
  }

  function next() {
    if (index + 1 >= questions.length) {
      setFinished(true);
      // נשמר ברקע: התוצאה כבר על המסך, ומה שנשאר הוא להזין את חישוב
      // השליטה. כישלון שמירה לא צריך לחסום את המסך.
      if (studySetId && answers.length > 0) {
        void recordQuizAttempt(studySetId, answers);
      }
    } else {
      setIndex(index + 1);
      setSelected(null);
    }
  }

  if (finished) {
    const score = Math.round((correctCount / questions.length) * 100);

    return (
      <div className="border-line rounded-lg border px-5 py-8 text-center">
        <p className="text-display text-ink">
          <span className="num">{score}</span>
        </p>
        <p className="text-small text-ink-body mt-2">
          ענית נכון על <span className="num">{correctCount}</span> מתוך{' '}
          <span className="num">{questions.length}</span> שאלות.
        </p>
        <p className="text-meta text-ink-faint mt-3">
          {score === 100
            ? 'החומר הזה יושב.'
            : score >= 70
              ? 'קרוב. עוד סיבוב על הכרטיסיות יסגור את הפערים.'
              : 'שווה לחזור על הסיכום ועל הכרטיסיות לפני סיבוב נוסף.'}
        </p>
        <button
          type="button"
          onClick={() => {
            setIndex(0);
            setSelected(null);
            setCorrectCount(0);
            setAnswers([]);
            setFinished(false);
          }}
          className="border-line-input text-label text-ink hover:bg-surface-sunk mt-5 rounded-md border px-5 py-2.5"
        >
          לתרגל שוב
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-meta text-ink-faint font-mono">
          שאלה <span className="num">{index + 1}</span> מתוך{' '}
          <span className="num">{questions.length}</span>
        </p>
        <p className="text-meta text-ink-faint">
          נכונות <span className="num">{correctCount}</span>
        </p>
      </div>

      <div className="mt-2">
        <ProgressBar value={index} max={questions.length} />
      </div>

      <h2 className="text-subheading text-ink mt-3">{question.stem}</h2>

      <div className="mt-5 flex flex-col gap-2.5">
        {question.options.map((option, i) => {
          const isCorrect = i === question.correct_index;
          const isChosen = i === selected;

          let tone = 'border-line-input text-ink';
          if (answered && isCorrect) tone = 'border-correct bg-correct-soft text-correct';
          else if (answered && isChosen) tone = 'border-wrong bg-wrong-soft text-wrong';
          else if (answered) tone = 'border-line text-ink-faint';

          return (
            <button
              key={i}
              type="button"
              onClick={() => choose(i)}
              disabled={answered}
              className={`text-body rounded-md border px-4 py-3.5 text-start transition-colors ${tone}`}
            >
              {option}
            </button>
          );
        })}
      </div>

      {answered ? (
        <div className="mt-5">
          {question.explanation ? (
            <p className="text-small text-ink-body bg-surface-sunk rounded-md px-4 py-3">
              {question.explanation}
            </p>
          ) : null}
          <button
            type="button"
            onClick={next}
            className="bg-ink text-on-ink text-label mt-4 w-full rounded-md px-6 py-3.5"
          >
            {index + 1 >= questions.length ? 'לתוצאה' : 'לשאלה הבאה'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
