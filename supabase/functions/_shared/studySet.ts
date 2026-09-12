/**
 * החוזה עם המודל.
 *
 * נאכף פעמיים: הסכימה כאן מוזנת ל-output_config.format ומכריחה את
 * המבנה בזמן הדגימה, ו-parseStudySet בודקת את התוכן עצמו לפני שמירה.
 * מערך ריק, מחרוזת ריקה או correct מחוץ לטווח לא מגיעים לתלמיד.
 *
 * ⚠️ **בלי אילוצי ערך.** structured outputs מקבל רק מבנה — type,
 * properties, required, items, additionalProperties, description.
 * `minItems`/`maxItems` על מערך ו-`minimum`/`maximum` על מספר מוחזרים
 * ב-400, והבקשה כולה נדחית לפני שהמודל קרא עמוד. שתי השגיאות האלה
 * עלו בייצור, אחת אחרי השנייה.
 *
 * במקומם: הכמויות נאמרות למודל בפרומפט (`budgets()` ב-model.ts),
 * התקרה נחתכת ב-`trimToBudgets`, והערכים נבדקים ב-parseStudySet —
 * `correct` מחוץ לטווח נדחה שם, לא בסכימה.
 *
 * ומכיוון שהסכימה לא אוכפת ערכים, **פריט פגום נזרק ולא מפיל את
 * המנה**. שאלה עם חמש אפשרויות שאחת מהן ריקה היא בדיוק מה שקרה
 * בייצור, והיא מחקה עיבוד של 13 עמודים. רק נושאים ריקים או סיכום
 * ריק מפילים את העיבוד — הם מה שאין בלעדיו מוצר.
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
      items: { type: 'string' },
      description: 'הנושאים שזוהו בחומר',
    },
    summary_sections: {
      type: 'array',
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
    key_points: { type: 'array', items: { type: 'string' } },
    definitions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['term', 'meaning'],
        properties: { term: { type: 'string' }, meaning: { type: 'string' } },
      },
    },
    flashcards: {
      type: 'array',
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
      items: questionSchema(),
    },
    exam_questions: {
      type: 'array',
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
      options: { type: 'array', items: { type: 'string' } },
      correct: { type: 'integer', description: 'מיקום התשובה הנכונה: 0, 1, 2 או 3' },
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
  /**
   * הטוקנים שהקריאה צרכה. הכשל קורה **אחרי** שהמודל כבר עבד ועלה
   * כסף, וכלל ברזל 7 אומר שגם כשל נרשם — בלי זה הוא נרשם עם אפס
   * טוקנים והתקרה משקרת.
   */
  usage?: unknown;

  constructor(reason: string) {
    super(`תשובת המודל לא במבנה הצפוי: ${reason}`);
    this.name = 'StudySetError';
  }
}

function arr(value: unknown, where: string): unknown[] {
  if (!Array.isArray(value)) throw new StudySetError(`${where} אינו מערך`);
  return value;
}

/**
 * שאלה אחת, או null אם היא לא ניתנת להצלה.
 *
 * **פריט פגום לא מפיל את המנה.** הסכימה לא יכולה לאכוף "בדיוק ארבע
 * תשובות" (structured outputs לא תומך ב-minItems/maxItems), ולכן
 * המודל מחזיר מדי פעם שאלה עם חמש אפשרויות שאחת מהן ריקה. הגרסה
 * הקודמת זרקה על זה את כל המנה — 13 עמודים, שתי דקות ו-0.26 דולר
 * שנשרפו בגלל שאלה אחת. עדיף 29 שאלות תקינות מ-30 שאבדו.
 */
function parseQuestion(raw: unknown): Question | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const q = raw as Record<string, unknown>;

  const stem = typeof q.q === 'string' ? q.q.trim() : '';
  if (!stem) return null;
  if (!Array.isArray(q.options)) return null;

  const correct = q.correct;
  if (typeof correct !== 'number' || !Number.isInteger(correct)) return null;

  // התשובה הנכונה מזוהה לפי האובייקט עצמו ולא לפי המיקום, כדי
  // שניקוי אפשרות ריקה לפניה לא יזיז את הסימון לתשובה שגויה.
  const marked = q.options[correct];
  const options = q.options
    .map((o) => (typeof o === 'string' ? o.trim() : ''))
    .filter((o) => o.length > 0);

  if (options.length !== 4) return null;

  const index = typeof marked === 'string' ? options.indexOf(marked.trim()) : -1;
  if (index < 0) return null;

  return {
    q: stem,
    options,
    correct: index,
    explanation: typeof q.explanation === 'string' ? q.explanation.trim() : '',
    topic: typeof q.topic === 'string' ? q.topic.trim() : '',
  };
}

/** פריט שנכשל נזרק; המנה ממשיכה עם מה שתקין. */
function compact<T>(values: unknown[], parse: (value: unknown) => T | null): T[] {
  const out: T[] = [];
  for (const value of values) {
    const parsed = parse(value);
    if (parsed !== null) out.push(parsed);
  }
  return out;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function parseStudySet(value: unknown): StudySet {
  if (typeof value !== 'object' || value === null) {
    throw new StudySetError('הגוף אינו אובייקט');
  }
  const v = value as Record<string, unknown>;

  const topics = compact(arr(v.topics, 'topics'), (t) => text(t) || null);
  if (topics.length === 0) throw new StudySetError('לא זוהה אף נושא');

  const summary_sections = compact(
    arr(v.summary_sections, 'summary_sections'),
    (sec) => {
      const o = sec as Record<string, unknown> | null;
      const heading = text(o?.heading);
      const body = text(o?.body);
      return heading && body ? { heading, body } : null;
    },
  );

  // הסיכום הוא הפריט שהתלמיד באמת לומד ממנו. בלעדיו אין מנה, ולכן
  // זה — יחד עם הנושאים — היחיד שמפיל את העיבוד.
  if (summary_sections.length === 0) throw new StudySetError('הסיכום ריק');

  return {
    // כותרת חסרה היא חסרון בתצוגה, לא סיבה לזרוק מנה שלמה.
    subject: text(v.subject) || 'כללי',
    title: text(v.title) || 'חומר לימוד',
    topics,
    summary_sections,
    key_points: compact(arr(v.key_points, 'key_points'), (p) => text(p) || null),
    definitions: compact(arr(v.definitions, 'definitions'), (d) => {
      const o = d as Record<string, unknown> | null;
      const term = text(o?.term);
      const meaning = text(o?.meaning);
      return term && meaning ? { term, meaning } : null;
    }),
    flashcards: compact(arr(v.flashcards, 'flashcards'), (c) => {
      const o = c as Record<string, unknown> | null;
      const q = text(o?.q);
      const a = text(o?.a);
      return q && a ? { q, a, topic: text(o?.topic) } : null;
    }),
    quiz_questions: compact(arr(v.quiz_questions, 'quiz_questions'), parseQuestion),
    exam_questions: compact(arr(v.exam_questions, 'exam_questions'), parseQuestion),
  };
}


/**
 * הסיכום כטקסט אחד, לעמודת `body` שממשיכה להיות מקור האמת הפשוט.
 * הפרקים נשמרים בנפרד ב-`sections` ומשמשים את התצוגה.
 */
export function summaryText(sections: SummarySection[]): string {
  return sections.map((s) => `${s.heading}\n\n${s.body}`).join('\n\n');
}
