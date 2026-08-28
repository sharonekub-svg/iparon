import { describe, expect, it } from 'vitest';

import { topicBreakdown, type AttemptResult } from '@/lib/study';

function answer(topic: string | null, isCorrect: boolean) {
  return {
    questionId: Math.random().toString(36),
    stem: 'שאלה',
    options: ['א', 'ב', 'ג', 'ד'],
    correctIndex: 0,
    selectedIndex: isCorrect ? 0 : 1,
    isCorrect,
    explanation: null,
    topic,
  };
}

function result(answers: AttemptResult['answers']): AttemptResult {
  return { score: 0, questionCount: answers.length, finishedAt: null, answers };
}

describe('topicBreakdown', () => {
  it('מפריד חזק מחלש בסף 70%', () => {
    const { strong, weak } = topicBreakdown(
      result([
        // 100% — חזק
        answer('ספיגה', true),
        answer('ספיגה', true),
        // 50% — חלש
        answer('אנזימים', true),
        answer('אנזימים', false),
      ]),
    );

    expect(strong.map((t) => t.name)).toEqual(['ספיגה']);
    expect(weak.map((t) => t.name)).toEqual(['אנזימים']);
    expect(strong[0].percent).toBe(100);
    expect(weak[0].percent).toBe(50);
  });

  it('70% בדיוק נחשב חזק', () => {
    const answers = [
      ...Array.from({ length: 7 }, () => answer('נושא', true)),
      ...Array.from({ length: 3 }, () => answer('נושא', false)),
    ];
    const { strong, weak } = topicBreakdown(result(answers));

    expect(strong).toHaveLength(1);
    expect(weak).toHaveLength(0);
    expect(strong[0].percent).toBe(70);
  });

  it('מתעלם משאלות בלי נושא', () => {
    const { strong, weak } = topicBreakdown(
      result([answer(null, true), answer(null, false)]),
    );
    expect(strong).toHaveLength(0);
    expect(weak).toHaveLength(0);
  });

  it('מסדר את החלשים מהגרוע לפחות גרוע', () => {
    const { weak } = topicBreakdown(
      result([
        answer('בינוני', true),
        answer('בינוני', false),
        answer('גרוע', false),
        answer('גרוע', false),
      ]),
    );
    expect(weak.map((t) => t.name)).toEqual(['גרוע', 'בינוני']);
  });

  it('שומר על ספירת נכונות מול סך השאלות', () => {
    const { weak } = topicBreakdown(
      result([answer('נושא', true), answer('נושא', false), answer('נושא', false)]),
    );
    expect(weak[0]).toMatchObject({ correct: 1, total: 3 });
  });
});
