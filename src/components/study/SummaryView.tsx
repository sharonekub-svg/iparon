import type { Summary } from '@/lib/study';

/**
 * מסך הסיכום — הפיצ'ר המרכזי של המוצר.
 *
 * הסיכום מגיע כפרקים, ולכן הוא נקרא בקפיצות ולא כגוש אחד: לפני מבחן
 * תלמיד מחפש נושא, לא קורא מהתחלה. חומר שעובד לפני שהפרקים נוספו
 * מגיע עם sections ריק, ואז מוצג body כפי שהוא.
 */
export function SummaryView({ summary, topics }: { summary: Summary; topics: string[] }) {
  const sections =
    summary.sections?.length > 0
      ? summary.sections
      : [{ heading: '', body: summary.body }];

  return (
    <div className="flex flex-col gap-10">
      {topics.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {topics.map((topic) => (
            <span
              key={topic}
              className="border-line-strong text-meta text-ink-body rounded-full border px-3 py-1.5"
            >
              {topic}
            </span>
          ))}
        </div>
      ) : null}

      {/* עיקרי הדברים לפני הסיכום המלא: מי שחוזר בערב המבחן מתחיל מכאן */}
      {summary.key_points.length > 0 ? (
        <section className="bg-ink shadow-lift rounded-2xl px-6 py-7">
          <h2 className="text-meta text-on-ink/50">עיקרי הדברים</h2>
          <ul className="mt-4 flex flex-col gap-3.5">
            {summary.key_points.map((point, i) => (
              <li key={i} className="flex gap-3">
                <span className="num text-meta text-on-ink/40 mt-1 shrink-0 font-mono">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="text-body text-on-ink">{point}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex flex-col gap-8">
        {sections.map((section, i) => (
          <section key={i}>
            {section.heading ? (
              <h2 className="text-heading text-ink border-line border-b pb-3 text-balance">
                {section.heading}
              </h2>
            ) : null}
            <div className="mt-4 flex flex-col gap-4">
              {section.body.split('\n\n').map((paragraph, j) => (
                <p key={j} className="text-body text-ink-body">
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>

      {summary.definitions.length > 0 ? (
        <section>
          <h2 className="text-heading text-ink border-line border-b pb-3">מושגים</h2>
          <dl className="mt-4 flex flex-col gap-2.5">
            {summary.definitions.map((def) => (
              <div
                key={def.term}
                className="border-line-strong bg-surface shadow-card rounded-xl border px-4 py-3.5"
              >
                <dt className="text-subheading text-ink">{def.term}</dt>
                <dd className="text-small text-ink-body mt-1">{def.meaning}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </div>
  );
}
