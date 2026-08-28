'use client';

import { useState } from 'react';

import { submitExam } from '@/app/(app)/sets/[id]/actions';

/** אות לכל תשובה — אותה שפה ויזואלית כמו בתרגול */
const LETTERS = ['א', 'ב', 'ג', 'ד', 'ה'];

export type ExamQuestion = {
  id: string;
  stem: string;
  options: string[];
};

/**
 * המבחן עצמו.
 *
 * בניגוד לקוויז — אין משוב תוך כדי, ואין כאן בכלל את התשובות הנכונות:
 * start_exam מחזירה שאלות בלי correct_index. אפשר לדלג ולחזור אחורה,
 * כמו במבחן אמיתי.
 */
export function ExamRunner({
  attemptId,
  questions,
  onFinished,
}: {
  attemptId: string;
  questions: ExamQuestion[];
  onFinished: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const question = questions[index];
  const answeredCount = Object.keys(answers).length;
  const isLast = index + 1 >= questions.length;

  async function submit() {
    setSubmitting(true);
    setError(null);

    const result = await submitExam(
      attemptId,
      Object.entries(answers).map(([question_id, selected_index]) => ({
        question_id,
        selected_index,
      })),
    );

    if (!result.ok) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    onFinished();
  }

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-meta text-ink-faint font-mono">
          שאלה <span className="num">{index + 1}</span> מתוך{' '}
          <span className="num">{questions.length}</span>
        </p>
        <p className="text-meta text-ink-faint">
          נענו <span className="num">{answeredCount}</span>
        </p>
      </div>

      <div className="bg-track mt-2 h-1 overflow-hidden rounded-full">
        <div
          className="bg-ink h-full transition-[width]"
          style={{ width: `${((index + 1) / questions.length) * 100}%` }}
        />
      </div>

      <h2 className="text-heading text-ink mt-4 text-balance">{question.stem}</h2>

      <div className="mt-6 flex flex-col gap-2.5">
        {question.options.map((option, i) => {
          const chosen = answers[question.id] === i;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setAnswers({ ...answers, [question.id]: i })}
              aria-pressed={chosen}
              className={`text-body tap flex w-full items-center gap-3 rounded-xl border px-4 py-4 text-start ${
                chosen
                  ? 'border-ink bg-surface text-ink shadow-card'
                  : 'border-line-input text-ink-body hover:border-ink hover:bg-surface'
              }`}
            >
              <span
                aria-hidden="true"
                className={`text-label flex size-7 shrink-0 items-center justify-center rounded-full border ${
                  chosen
                    ? 'border-ink bg-ink text-on-ink'
                    : 'border-line-input text-ink-faint'
                }`}
              >
                {LETTERS[i]}
              </span>
              <span className="flex-1">{option}</span>
            </button>
          );
        })}
      </div>

      {error ? (
        <p
          role="alert"
          className="text-small bg-wrong-soft text-wrong mt-4 rounded-md px-4 py-3"
        >
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={() => setIndex(index - 1)}
          disabled={index === 0}
          className="border-line-input text-label text-ink hover:bg-surface-sunk tap rounded-lg border px-5 py-3.5 disabled:opacity-40"
        >
          הקודמת
        </button>

        {isLast ? (
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="bg-ink text-on-ink text-label tap flex-1 rounded-lg px-6 py-3.5 hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? 'בודק...' : 'הגש מבחן'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIndex(index + 1)}
            className="bg-ink text-on-ink text-label tap flex-1 rounded-lg px-6 py-3.5 hover:opacity-90"
          >
            הבאה
          </button>
        )}
      </div>

      {isLast && answeredCount < questions.length ? (
        <p className="text-meta text-ink-faint mt-3">
          נשארו <span className="num">{questions.length - answeredCount}</span> שאלות בלי
          תשובה. שאלה שלא נענתה נחשבת שגויה.
        </p>
      ) : null}
    </div>
  );
}
