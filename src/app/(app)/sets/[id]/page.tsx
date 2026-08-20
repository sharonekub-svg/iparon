import { getSummary, getTopics } from '@/lib/study';

export default async function SummaryPage({ params }: PageProps<'/sets/[id]'>) {
  const { id } = await params;
  const [summary, topics] = await Promise.all([getSummary(id), getTopics(id)]);

  if (!summary) {
    return <p className="text-small text-ink-muted">אין עדיין סיכום לחומר הזה.</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      {topics.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {topics.map((topic) => (
            <span
              key={topic}
              className="bg-surface-sunk text-meta text-ink-body rounded-xs px-2.5 py-1"
            >
              {topic}
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        {summary.body.split('\n\n').map((paragraph, i) => (
          <p key={i} className="text-body text-ink-body">
            {paragraph}
          </p>
        ))}
      </div>

      {summary.key_points.length > 0 ? (
        <section className="border-line rounded-lg border px-5 py-5">
          <h2 className="text-subheading text-ink">עיקרי הדברים</h2>
          <ul className="mt-3 flex flex-col gap-2.5">
            {summary.key_points.map((point, i) => (
              <li key={i} className="text-small text-ink-body flex gap-2.5">
                <span className="text-ink-faintest mt-2 size-1 shrink-0 rounded-full bg-current" />
                {point}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {summary.definitions.length > 0 ? (
        <section>
          <h2 className="text-subheading text-ink">מושגים</h2>
          <dl className="mt-3 flex flex-col gap-3.5">
            {summary.definitions.map((def) => (
              <div key={def.term}>
                <dt className="text-bodyStrong text-ink font-semibold">{def.term}</dt>
                <dd className="text-small text-ink-body mt-0.5">{def.meaning}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </div>
  );
}
