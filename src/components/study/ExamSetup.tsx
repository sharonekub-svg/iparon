'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ExamRunner, type ExamQuestion } from './ExamRunner';

import { startExam } from '@/app/(app)/sets/[id]/actions';
import type { ExamScope } from '@/lib/study';

/**
 * בחירת היקף המבחן ואורכו.
 *
 * ההיקף הוא נושא בודד או כל החומר. אורך המבחן מוצע רק במספרים
 * שקיימים בפועל במאגר — אין טעם להציע 20 שאלות על נושא שיש בו 6.
 */
const LENGTHS = [10, 20, 30] as const;

export function ExamSetup({
  studySetId,
  scopes,
}: {
  studySetId: string;
  scopes: ExamScope[];
}) {
  const router = useRouter();
  const [scopeIndex, setScopeIndex] = useState(0);
  const [count, setCount] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exam, setExam] = useState<{
    attemptId: string;
    questions: ExamQuestion[];
  } | null>(null);

  const scope = scopes[scopeIndex];

  // רק אורכים שהמאגר באמת מכיל, ותמיד האפשרות "הכול"
  const options = LENGTHS.filter((n) => n < scope.available);
  const effective = count && count <= scope.available ? count : scope.available;

  async function start() {
    setStarting(true);
    setError(null);

    const result = await startExam(studySetId, scope.topicId, effective);

    if (!result.ok) {
      setError(result.error);
      setStarting(false);
      return;
    }

    setExam(result.data);
    setStarting(false);
  }

  if (exam) {
    return (
      <ExamRunner
        attemptId={exam.attemptId}
        questions={exam.questions}
        onFinished={() => router.push(`/sets/${studySetId}/results/${exam.attemptId}`)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="text-subheading text-ink">על מה להיבחן?</h2>
        <div className="mt-3 flex flex-col gap-2">
          {scopes.map((option, i) => {
            const active = i === scopeIndex;
            return (
              <button
                key={option.topicId ?? 'all'}
                type="button"
                onClick={() => {
                  setScopeIndex(i);
                  setCount(null);
                }}
                aria-pressed={active}
                className={`flex items-center justify-between rounded-md border px-4 py-3.5 text-start transition-colors ${
                  active
                    ? 'border-ink bg-surface-sunk text-ink'
                    : 'border-line-input text-ink-body hover:bg-surface-sunk'
                }`}
              >
                <span className="text-body">{option.name}</span>
                <span className="text-meta text-ink-faint font-mono">
                  <span className="num">{option.available}</span> שאלות
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-subheading text-ink">כמה שאלות?</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {options.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setCount(n)}
              aria-pressed={count === n}
              className={`text-label min-w-16 rounded-md border px-4 py-3 transition-colors ${
                count === n
                  ? 'border-ink bg-surface-sunk text-ink'
                  : 'border-line-input text-ink-body hover:bg-surface-sunk'
              }`}
            >
              <span className="num">{n}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCount(null)}
            aria-pressed={count === null}
            className={`text-label rounded-md border px-4 py-3 transition-colors ${
              count === null
                ? 'border-ink bg-surface-sunk text-ink'
                : 'border-line-input text-ink-body hover:bg-surface-sunk'
            }`}
          >
            הכול (<span className="num">{scope.available}</span>)
          </button>
        </div>
      </section>

      {error ? (
        <p
          role="alert"
          className="text-small bg-wrong-soft text-wrong rounded-md px-4 py-3"
        >
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={start}
        disabled={starting}
        className="bg-ink text-on-ink text-label rounded-md px-6 py-3.5 disabled:opacity-50"
      >
        {starting ? 'רגע...' : 'התחל מבחן'}
      </button>

      <p className="text-meta text-ink-faint">
        במבחן אין משוב תוך כדי. הציון והנושאים החלשים מוצגים בסוף.
      </p>
    </div>
  );
}
