'use client';

import { useState } from 'react';

import { FlashcardDeck } from '@/components/study/FlashcardDeck';
import { Quiz } from '@/components/study/Quiz';
import { demoFlashcards, demoQuiz, demoSummary } from '@/lib/demoStudySet';

const TABS = ['סיכום', 'כרטיסיות', 'תרגול'] as const;

export function DemoTabs() {
  const [active, setActive] = useState(0);

  return (
    <>
      <nav className="border-line mt-6 flex gap-1 border-b" aria-label="חלקי החומר">
        {TABS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setActive(i)}
            aria-current={active === i ? 'page' : undefined}
            className={`text-label -mb-px border-b-2 px-3.5 py-2.5 transition-colors ${
              active === i
                ? 'border-ink text-ink'
                : 'text-ink-faint hover:text-ink border-transparent'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="mt-6">
        {active === 0 ? <Summary /> : null}
        {/* key מאפס את החפיסה בכל חזרה לטאב, כדי שהדמו תמיד מתחיל מהתחלה */}
        {active === 1 ? (
          <FlashcardDeck key="cards" cards={[...demoFlashcards]} persistRatings={false} />
        ) : null}
        {active === 2 ? <Quiz key="quiz" questions={[...demoQuiz]} /> : null}
      </div>
    </>
  );
}

function Summary() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap gap-2">
        {demoSummary.topics.map((topic) => (
          <span
            key={topic}
            className="bg-surface-sunk text-meta text-ink-body rounded-xs px-2.5 py-1"
          >
            {topic}
          </span>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        {demoSummary.body.map((paragraph, i) => (
          <p key={i} className="text-body text-ink-body">
            {paragraph}
          </p>
        ))}
      </div>

      <section className="border-line rounded-lg border px-5 py-5">
        <h2 className="text-subheading text-ink">עיקרי הדברים</h2>
        <ul className="mt-3 flex flex-col gap-2.5">
          {demoSummary.keyPoints.map((point) => (
            <li key={point} className="text-small text-ink-body flex gap-2.5">
              <span className="text-ink-faintest mt-2 size-1 shrink-0 rounded-full bg-current" />
              {point}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-subheading text-ink">מושגים</h2>
        <dl className="mt-3 flex flex-col gap-3.5">
          {demoSummary.definitions.map((def) => (
            <div key={def.term}>
              <dt className="text-bodyStrong text-ink font-semibold">{def.term}</dt>
              <dd className="text-small text-ink-body mt-0.5">{def.meaning}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
