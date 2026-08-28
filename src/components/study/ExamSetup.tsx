'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ExamRunner, type ExamQuestion } from './ExamRunner';

import { startExam } from '@/app/(app)/sets/[id]/actions';
import { ScopePicker } from '@/components/study/ScopePicker';
import type { ExamScopes } from '@/lib/study';

/**
 * בחירת היקף המבחן ואורכו.
 *
 * ההיקף הוא צירוף חופשי של נושאים: נושא אחד, שניים, או כולם. אורך
 * המבחן מוצע רק במספרים שקיימים בפועל במאגר של ההיקף שנבחר — אין טעם
 * להציע 20 שאלות על נושא שיש בו 6.
 */
const LENGTHS = [10, 20, 30, 40] as const;

export function ExamSetup({
  studySetId,
  scopes,
}: {
  studySetId: string;
  scopes: ExamScopes;
}) {
  const router = useRouter();
  // ברירת המחדל היא כל החומר — זה מה שרוב התלמידים ירצו לפני מבחן
  const [topicIds, setTopicIds] = useState<string[]>(scopes.topics.map((t) => t.topicId));
  const [count, setCount] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exam, setExam] = useState<{
    attemptId: string;
    questions: ExamQuestion[];
  } | null>(null);

  const everything = topicIds.length === scopes.topics.length;
  // כשנבחר הכול נשלח מערך ריק, וכך נכנסות גם שאלות שלא שויכו לנושא
  const available = everything
    ? scopes.total
    : scopes.topics
        .filter((t) => topicIds.includes(t.topicId))
        .reduce((sum, t) => sum + t.available, 0);

  const options = LENGTHS.filter((n) => n < available);
  const effective = count && count <= available ? count : available;

  async function start() {
    setStarting(true);
    setError(null);

    const result = await startExam(studySetId, everything ? [] : topicIds, effective);

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
      <ScopePicker
        title="על מה להיבחן?"
        items={scopes.topics.map((t) => ({
          id: t.topicId,
          name: t.name,
          available: t.available,
        }))}
        selected={topicIds}
        onChange={(next) => {
          setTopicIds(next);
          setCount(null);
        }}
      />

      <section>
        <h2 className="text-subheading text-ink">כמה שאלות?</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {options.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setCount(n)}
              aria-pressed={count === n}
              className={`text-label tap min-w-16 rounded-xl border px-4 py-3 ${
                count === n
                  ? 'border-ink bg-ink text-on-ink'
                  : 'border-line-input text-ink-body hover:border-ink hover:bg-surface'
              }`}
            >
              <span className="num">{n}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCount(null)}
            aria-pressed={count === null}
            className={`text-label tap rounded-xl border px-4 py-3 ${
              count === null
                ? 'border-ink bg-ink text-on-ink'
                : 'border-line-input text-ink-body hover:border-ink hover:bg-surface'
            }`}
          >
            הכול (<span className="num">{available}</span>)
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
        className="bg-ink text-on-ink text-label tap rounded-lg px-6 py-4 hover:opacity-90 disabled:opacity-50"
      >
        {starting ? 'רגע...' : 'התחל מבחן'}
      </button>

      <p className="text-meta text-ink-faint">
        במבחן אין משוב תוך כדי. הציון והנושאים החלשים מוצגים בסוף.
      </p>
    </div>
  );
}
