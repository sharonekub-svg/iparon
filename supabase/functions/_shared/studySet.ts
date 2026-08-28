/**
 * החוזה עם המודל.
 *
 * נאכף פעמיים: הסכימה כאן מוזנת ל-output_config.format ומכריחה את
 * המבנה בזמן הדגימה, ו-parseStudySet בודקת את התוכן עצמו לפני שמירה.
 * מערך ריק, מחרוזת ריקה או correct מחוץ לטווח לא מגיעים לתלמיד.
 */

export const studySetSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'subject',
    'title',
    'topics',
    'summary_sections',
    'key_points',
    'definitions',
    'flashcards',
    'quiz_questions',
    'exam_questions',
  ],
  properties: {
    subject: { type: 'string', description: 'מקצוע הלימוד בעברית, למשל ביולוגיה' },
    title: { type: 'string', description: 'כותרת קצרה לחומר, בעברית' },
    topics: {
      type: 'array',
      minItems: 1,
      maxItems: 8,
      items: { type: 'string' },
      description: 'הנושאים שזוהו בחומר',
    },
    summary_sections: {
      type: 'array',
      minItems: 1,
      maxItems: 12,
      description: 'הסיכום, מחולק לפרקים לפי הנושאים בחומר ובסדר שבו הם מופיעים',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['heading', 'body'],
        properties: {
          heading: { type: 'string', description: 'כותרת הפרק בעברית, קצרה' },
          body: {
            type: 'string',
            description: 'גוף הפרק. פסקאות מופרדות בשורה ריקה כפולה',
          },
        },
      },
    },
    key_points: { type: 'array', minItems: 3, maxItems: 14, items: { type: 'string' } },
    definitions: {
      type: 'array',
      maxItems: 30,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['term', 'meaning'],
        properties: { term: { type: 'string' }, meaning: { type: 'string' } },
      },
    },
    flashcards: {
      type: 'array',
      minItems: 8,
      maxItems: 40,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['q', 'a', 'topic'],
        properties: {
          q: { type: 'string' },
          a: { type: 'string' },
          topic: { type: 'string', description: 'אחד מהנושאים ברשימת topics' },
        },
      },
    },
    quiz_questions: {
      type: 'array',
      minItems: 8,
      maxItems: 25,
      items: questionSchema(),
    },
    exam_questions: {
      type: 'array',
      minItems: 15,
      maxItems: 60,
      items: questionSchema(),
    },
  },
} as const;

function questionSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['q', 'options', 'correct', 'explanation', 'topic'],
    properties: {
      q: { type: 'string' },
      options: { type: 'array', minItems: 4, maxItems: 4, items: { type: 'string' } },
      correct: { type: 'integer', minimum: 0, maximum: 3 },
      explanation: { type: 'string' },
      topic: { type: 'string' },
    },
  };
}

export type Definition = { term: string; meaning: string };
export type SummarySection = { heading: string; body: string };
export type Flashcard = { q: string; a: string; topic: string };
export type Question = {
  q: string;
  options: string[];
  correct: number;
  explanation: string;
  topic: string;
};

export type StudySet = {
  subject: string;
  title: string;
  topics: string[];
  /** הסיכום כפרקים. `summaryText` הוא אותו תוכן כטקסט אחד, לעמודת body. */
  summary_sections: SummarySection[];
  key_points: string[];
  definitions: Definition[];
  flashcards: Flashcard[];
  quiz_questions: Question[];
  exam_questions: Question[];
};

export class StudySetError extends Error {
  constructor(reason: string) {
    super(`תשובת המודל לא במבנה הצפוי: ${reason}`);
    this.name = 'StudySetError';
  }
}

function str(value: unknown, where: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new StudySetError(`${where} חסר או ריק`);
  }
  return value.trim();
}

function arr(value: unknown, where: string): unknown[] {
  if (!Array.isArray(value)) throw new StudySetError(`${where} אינו מערך`);
  return value;
}

function parseQuestion(raw: unknown, where: string): Question {
  if (typeof raw !== 'object' || raw === null)
    throw new StudySetError(`${where} אינו אובייקט`);
  const q = raw as Record<string, unknown>;

  const options = arr(q.options, `${where}.options`).map((o, i) =>
    str(o, `${where}.options[${i}]`),
  );
  if (options.length !== 4) throw new StudySetError(`${where}: צריך בדיוק ארבע תשובות`);

  const correct = q.correct;
  if (
    typeof correct !== 'number' ||
    !Number.isInteger(correct) ||
    correct < 0 ||
    correct >= options.length
  ) {
    throw new StudySetError(`${where}: correct מחוץ לטווח`);
  }

  return {
    q: str(q.q, `${where}.q`),
    options,
    correct,
    explanation: typeof q.explanation === 'string' ? q.explanation.trim() : '',
    topic: typeof q.topic === 'string' ? q.topic.trim() : '',
  };
}

export function parseStudySet(value: unknown): StudySet {
  if (typeof value !== 'object' || value === null) {
    throw new StudySetError('הגוף אינו אובייקט');
  }
  const v = value as Record<string, unknown>;

  const topics = arr(v.topics, 'topics').map((t, i) => str(t, `topics[${i}]`));
  if (topics.length === 0) throw new StudySetError('לא זוהה אף נושא');

  return {
    subject: str(v.subject, 'subject'),
    title: str(v.title, 'title'),
    topics,
    summary_sections: (() => {
      const sections = arr(v.summary_sections, 'summary_sections').map((sec, i) => {
        const o = sec as Record<string, unknown>;
        return {
          heading: str(o?.heading, `summary_sections[${i}].heading`),
          body: str(o?.body, `summary_sections[${i}].body`),
        };
      });
      if (sections.length === 0) throw new StudySetError('הסיכום ריק');
      return sections;
    })(),
    key_points: arr(v.key_points, 'key_points').map((p, i) => str(p, `key_points[${i}]`)),
    definitions: arr(v.definitions, 'definitions').map((d, i) => {
      const o = d as Record<string, unknown>;
      return {
        term: str(o?.term, `definitions[${i}].term`),
        meaning: str(o?.meaning, `definitions[${i}].meaning`),
      };
    }),
    flashcards: arr(v.flashcards, 'flashcards').map((c, i) => {
      const o = c as Record<string, unknown>;
      return {
        q: str(o?.q, `flashcards[${i}].q`),
        a: str(o?.a, `flashcards[${i}].a`),
        topic: typeof o?.topic === 'string' ? o.topic.trim() : '',
      };
    }),
    quiz_questions: arr(v.quiz_questions, 'quiz_questions').map((q, i) =>
      parseQuestion(q, `quiz_questions[${i}]`),
    ),
    exam_questions: arr(v.exam_questions, 'exam_questions').map((q, i) =>
      parseQuestion(q, `exam_questions[${i}]`),
    ),
  };
}


/**
 * הסיכום כטקסט אחד, לעמודת `body` שממשיכה להיות מקור האמת הפשוט.
 * הפרקים נשמרים בנפרד ב-`sections` ומשמשים את התצוגה.
 */
export function summaryText(sections: SummarySection[]): string {
  return sections.map((s) => `${s.heading}\n\n${s.body}`).join('\n\n');
}
