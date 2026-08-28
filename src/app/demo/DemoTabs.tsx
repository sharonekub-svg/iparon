'use client';

import { useState } from 'react';

import { FlashcardDeck } from '@/components/study/FlashcardDeck';
import { SummaryView } from '@/components/study/SummaryView';
import { QuizSetup } from '@/components/study/QuizSetup';
import { demoFlashcards, demoQuiz, demoSummary } from '@/lib/demoStudySet';

const TABS = ['סיכום', 'כרטיסיות', 'תרגול'] as const;

export function DemoTabs() {
  const [active, setActive] = useState(0);

  return (
    <>
      <nav
        className="bg-surface-sunk mt-6 flex gap-1 rounded-full p-1"
        aria-label="חלקי החומר"
      >
        {TABS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setActive(i)}
            aria-current={active === i ? 'page' : undefined}
            className={`text-label tap flex-1 rounded-full px-3.5 py-2.5 ${
              active === i
                ? 'bg-surface text-ink shadow-card'
                : 'text-ink-faint hover:text-ink'
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
        {active === 2 ? (
          <QuizSetup
            key="quiz"
            questions={demoQuiz.map((q) => ({ ...q, options: [...q.options] }))}
          />
        ) : null}
      </div>
    </>
  );
}

/**
 * הדמו מציג את אותו רכיב שמציג חומר אמיתי. אם התצוגה משתנה, היא
 * משתנה בשני המקומות — ואי אפשר שהדמו ייראה טוב יותר מהמוצר.
 */
function Summary() {
  return (
    <SummaryView
      topics={[...demoSummary.topics]}
      summary={{
        body: '',
        sections: demoSummary.sections.map((s) => ({ ...s })),
        key_points: [...demoSummary.keyPoints],
        definitions: demoSummary.definitions.map((d) => ({ ...d })),
      }}
    />
  );
}
