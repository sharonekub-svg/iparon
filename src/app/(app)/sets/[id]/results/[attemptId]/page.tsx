import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getAttemptResult, topicBreakdown } from '@/lib/study';

export const metadata = { title: 'תוצאות' };

export default async function ResultsPage({
  params,
}: PageProps<'/sets/[id]/results/[attemptId]'>) {
  const { id, attemptId } = await params;
  const result = await getAttemptResult(attemptId);

  if (!result) notFound();

  const { strong, weak } = topicBreakdown(result);
  const correct = result.answers.filter((a) => a.isCorrect).length;

  return (
    <div className="flex flex-col gap-8">
      <div className="rise bg-ink shadow-lift rounded-2xl px-5 py-12 text-center">
        <p className="text-meta text-on-ink/50">הציון שלך</p>
        <p className="num text-figure text-on-ink mt-2">{result.score}</p>
        <p className="text-small text-on-ink/70 mt-3">
          ענית נכון על <span className="num">{correct}</span> מתוך{' '}
          <span className="num">{result.answers.length}</span> שאלות
        </p>
      </div>

      {weak.length > 0 ? (
        <section>
          <h2 className="text-subheading text-ink">כדאי לחזור על</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {weak.map((topic) => (
              <li
                key={topic.name}
                className="border-line-strong bg-surface rounded-xl border px-4 py-3.5"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-body text-ink">{topic.name}</span>
                  <span className="num text-meta text-ink-faint shrink-0 font-mono">
                    {topic.correct}/{topic.total}
                  </span>
                </div>
                <div className="bg-track mt-2.5 h-1.5 overflow-hidden rounded-full">
                  <div
                    className="bg-ink h-full rounded-full"
                    style={{ width: `${(topic.correct / topic.total) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {strong.length > 0 ? (
        <section>
          <h2 className="text-subheading text-ink">אתה חזק ב</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {strong.map((topic) => (
              <li
                key={topic.name}
                className="border-line-strong bg-surface rounded-xl border px-4 py-3.5"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-body text-ink">{topic.name}</span>
                  <span className="num text-meta text-ink-faint shrink-0 font-mono">
                    {topic.correct}/{topic.total}
                  </span>
                </div>
                <div className="bg-track mt-2.5 h-1.5 overflow-hidden rounded-full">
                  <div
                    className="bg-ink h-full rounded-full"
                    style={{ width: `${(topic.correct / topic.total) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="text-subheading text-ink">התשובות</h2>
        <ol className="mt-3 flex flex-col gap-5">
          {result.answers.map((answer, i) => (
            <li
              key={answer.questionId}
              className="border-line border-b pb-5 last:border-b-0"
            >
              <div className="flex gap-2.5">
                <span className="text-meta text-ink-faint mt-1 font-mono">
                  <span className="num">{i + 1}</span>
                </span>
                <div className="flex-1">
                  <p className="text-bodyStrong text-ink font-semibold">{answer.stem}</p>

                  <p
                    className={`text-small mt-2 ${
                      answer.isCorrect ? 'text-correct' : 'text-wrong'
                    }`}
                  >
                    {answer.selectedIndex === null
                      ? 'לא ענית'
                      : `ענית: ${answer.options[answer.selectedIndex]}`}
                  </p>

                  {!answer.isCorrect ? (
                    <p className="text-small text-correct mt-1">
                      התשובה הנכונה: {answer.options[answer.correctIndex]}
                    </p>
                  ) : null}

                  {answer.explanation ? (
                    <p className="text-small text-ink-body bg-surface-sunk mt-2.5 rounded-xl px-3.5 py-2.5">
                      {answer.explanation}
                    </p>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <Link
        href={`/sets/${id}/exam`}
        className="border-line-input text-label text-ink hover:bg-surface-sunk tap rounded-lg border px-6 py-4 text-center"
      >
        מבחן נוסף
      </Link>
    </div>
  );
}
