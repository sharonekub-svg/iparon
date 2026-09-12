import Anthropic from 'npm:@anthropic-ai/sdk@0.115.0';

import { env } from './env.ts';
import { UserError } from './errors.ts';
import {
  parseStudySet,
  StudySetError,
  studySetSchema,
  type StudySet,
} from './studySet.ts';

/**
 * כלל ברזל 4: בלי OCR ובלי חילוץ טקסט מ-PDF.
 * עברית נשברת בשתי הדרכים — כתב יד לא מזוהה, ו-PDF עברי מחזיר טקסט
 * הפוך ומשובש בלי להתריע. הקובץ נשלח כמו שהוא למודל ראייה: PDF כבלוק
 * document שבו המודל רואה כל עמוד כתמונה, וצילום כבלוק image.
 */
const IMAGE_TYPES = ['image/jpeg', 'image/png'] as const;

export type SupportedMediaType = 'application/pdf' | (typeof IMAGE_TYPES)[number];

export function isSupportedMediaType(value: string): value is SupportedMediaType {
  return (
    value === 'application/pdf' || (IMAGE_TYPES as readonly string[]).includes(value)
  );
}

/**
 * בדיקת magic bytes. כלל ברזל: לא סומכים על הסיומת ולא על ה-MIME
 * שהלקוח הצהיר עליו — שניהם נשלטים על ידי מי שמעלה.
 */
export function sniffMediaType(bytes: Uint8Array): SupportedMediaType | null {
  if (bytes.length < 8) return null;
  const b = bytes;
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) {
    return 'application/pdf'; // %PDF
  }
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a
  ) {
    return 'image/png';
  }
  return null;
}

/** כלל ברזל 6 — כל ההגבלות נאמרות למודל במפורש. */
const SYSTEM_PROMPT = `אתה עוזר לימוד לתלמידי חטיבה ותיכון בישראל.

מגיע אליך חומר לימוד: סיכום, דף מחברת מצולם, או פרק מספר. התפקיד שלך הוא
להפוך אותו לחומר לימוד מסודר: נושאים, סיכום, כרטיסיות, שאלות תרגול, ומאגר
שאלות למבחן.

כללים מחייבים:
1. כל הפלט בעברית. כל שדה, כל שאלה, כל תשובה. אין יוצא מן הכלל.
2. השתמש אך ורק במידע שמופיע בחומר שהועלה. אל תוסיף ידע חיצוני, גם אם אתה
   יודע את התשובה ממקום אחר, וגם אם החומר חלקי או שגוי.
3. אל תמציא. אם משהו בחומר לא קריא או לא ברור, פשוט אל תכלול אותו. עדיף
   פחות פריטים נכונים מפריט אחד שהומצא.
4. אם החומר קצר, החזר פחות פריטים. אל תמתח אותו ואל תמלא במילים.

## הנושאים

2 עד 8 נושאים שבאמת מופיעים בחומר. כל שאר הפריטים משויכים לאחד מהם בשדה
topic, במחרוזת זהה בדיוק לאחד מהנושאים ברשימה.

## הסיכום — הפריט החשוב ביותר

התלמיד ילמד מהסיכום הזה במקום לקרוא את החומר המקורי. לכן הוא צריך להיות
**מלא ומרוכז**: כל מה שיש בחומר נמצא בו, בלי מילה מיותרת.

- **פרק לכל נושא**, בסדר שבו הנושאים מופיעים בחומר. הכותרת קצרה ועניינית.
- **כיסוי מלא.** עבור על החומר מתחילתו ועד סופו וודא שכל מה שנמצא בו נכנס:
  כל תהליך, כל מנגנון, כל הגדרה, כל דוגמה, כל מספר, כל שם, כל סיווג, כל
  יוצא מן הכלל. נושא שהופיע בחומר ולא מופיע בסיכום — זו טעות.
- **צפוף.** כל משפט נושא מידע. בלי הקדמות, בלי "בסיכום זה נלמד", בלי
  "לסיכום", בלי חזרה על מה שכבר נאמר, ובלי משפטי מעבר.
- **מסביר, לא מונה.** משפטים שלמים שמלמדים את התלמיד — למה זה קורה, איך
  זה עובד, מה נובע ממה. לא רשימת מילות מפתח.
- **תהליך נכתב לפי סדר השלבים**, ואם החומר נותן שמות לשלבים, השמות נשמרים.
- **טבלה, תרשים או ציור בחומר** מומרים למשפטים שמוסרים את אותו מידע.
- **מונחים, מספרים ושמות נשמרים בדיוק כפי שהם בחומר** — זו השפה שהמורה
  יבחן בה. אל תחליף מונח במילה נרדפת.
- פסקאות בתוך פרק מופרדות בשורה ריקה כפולה.

עיקרי הדברים: המשפטים שתלמיד חייב לזכור, כל אחד עומד בפני עצמו.
מושגים: כל מונח מקצועי שמופיע בחומר, עם הסבר שלו מתוך החומר.

## הכרטיסיות

שאלה אחת ממוקדת וקצרה, ותשובה **שלמה**. התשובה היא משפט קצר ולא מילה בודדת.

- אם לשאלה יש כמה חלקים — כל החלקים בתשובה. "מה התפקיד הכפול של חומצת
  המלח?" מקבל את שני התפקידים, לא אחד.
- אם החומר מוסיף פרט רלוונטי — היכן זה קורה, מי מפריש, מה התוצאה — הפרט
  נכנס לתשובה. תשובה נכונה אך חלקית היא תשובה גרועה.
- מושג אחד בכל כרטיסייה. כרטיסייה אחת לכל דבר שצריך לזכור בחומר.

## שאלות התרגול ושאלות המבחן

כל שאלה עם בדיוק ארבע תשובות ותשובה נכונה אחת, ועם הסבר קצר לתשובה הנכונה.

- **כמות.** תן כמה שיותר שאלות שהחומר באמת מאפשר, עד המכסה שתקבל
  בהוראה. חומר עשיר מגיע למכסה; חומר דל נעצר הרבה לפניה. אל תעצור
  כשיש עוד מה לשאול — אבל אל תשאל פעמיים על אותו דבר בניסוח אחר, ואל
  תמציא שאלות כדי להגיע למספר.
- **פיזור.** השאלות מכסות את כל הנושאים, לא רק את הראשון, וגם את הפרטים
  הקטנים ולא רק את הכותרות.
- שלוש התשובות השגויות צריכות להיות סבירות ומבוססות על החומר, לא
  אבסורדיות — מסיח דעת טוב הוא טעות שתלמיד באמת עושה.
- פזר את מקום התשובה הנכונה בין השאלות.
- שאלות המבחן חייבות לכסות כל נושא ונושא, כדי שאפשר יהיה להיבחן על נושא
  בודד בנפרד וגם על כל החומר יחד.
- שאלות התרגול ושאלות המבחן הן שאלות שונות. אל תחזור על אותה שאלה בשתי
  הרשימות.`;

/**
 * המכסות נגזרות מכמות החומר ולא קבועות.
 *
 * שתי סיבות, ושתיהן חשובות. תוכנית: דף מחברת אחד שמקבל 60 שאלות מבחן
 * מקבל שאלות ממולאות במים, והתלמיד מפסיק לסמוך על המוצר. כלכלית: הפלט
 * הוא רוב עלות הקריאה (~86%), והוא כמעט קבוע לכל קריאה — כלומר חומר
 * קטן שמייצר פלט מלא עולה כמעט כמו חומר גדול, ומחויב על הרבה פחות.
 */
function budgets(pages: number) {
  const clamp = (value: number, low: number, high: number) =>
    Math.min(high, Math.max(low, Math.round(value)));

  return {
    flashcards: clamp(pages * 2, 4, 40),
    quiz: clamp(pages * 1.2, 4, 25),
    exam: clamp(pages * 3, 6, 60),
  };
}

function userPrompt(pages: number): string {
  const budget = budgets(pages);

  return `זה החומר. יש בו ${pages} עמודים.

עבור עליו מתחילתו ועד סופו, וודא שאין בו דבר שלא נכנס לסיכום, והחזר את
חומר הלימוד לפי הכללים — בעברית, ורק ממה שמופיע כאן.

המכסה לחומר בגודל הזה: עד ${budget.flashcards} כרטיסיות, עד ${budget.quiz}
שאלות תרגול, ועד ${budget.exam} שאלות מבחן. זו תקרה ולא יעד — אם החומר
לא מאפשר כל כך הרבה, החזר פחות. עדיף חצי מהכמות באיכות מלאה מאשר
המכסה כולה עם שאלות ממולאות במים.`;
}

export type ModelUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  costUsd: number;
};

/** דולר למיליון טוקנים. קריאה מהמאגר היא כעשירית ממחיר הקלט. */
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-5': { input: 5, output: 25 },
  'claude-sonnet-5': { input: 2, output: 10 },
  'claude-haiku-4-5': { input: 1, output: 5 },
};

function estimateCost(model: string, usage: Omit<ModelUsage, 'costUsd'>): number {
  const rate = PRICING[model] ?? PRICING['claude-opus-5'];
  return (
    (usage.inputTokens * rate.input +
      usage.outputTokens * rate.output +
      usage.cacheReadTokens * rate.input * 0.1) /
    1_000_000
  );
}

/**
 * התקרה שהסכימה לא יכולה לאכוף.
 *
 * structured outputs לא תומך ב-maxItems, ולכן מודל שיחליט להחזיר 200
 * כרטיסיות על דף אחד יעשה את זה. החיתוך כאן הוא הגבול האמיתי — גם
 * מול עלות וגם מול תלמיד שמקבל 200 כרטיסיות ומוותר.
 */
function trimToBudgets(set: StudySet, pages: number): StudySet {
  const budget = budgets(pages);

  return {
    ...set,
    topics: set.topics.slice(0, 8),
    summary_sections: set.summary_sections.slice(0, 12),
    key_points: set.key_points.slice(0, 14),
    definitions: set.definitions.slice(0, 30),
    flashcards: set.flashcards.slice(0, budget.flashcards),
    quiz_questions: set.quiz_questions.slice(0, budget.quiz),
    exam_questions: set.exam_questions.slice(0, budget.exam),
  };
}

export type FilePart = { mediaType: SupportedMediaType; base64: string };

function block(part: FilePart) {
  if (part.mediaType === 'application/pdf') {
    return {
      type: 'document' as const,
      source: { type: 'base64' as const, media_type: part.mediaType, data: part.base64 },
    };
  }
  return {
    type: 'image' as const,
    source: { type: 'base64' as const, media_type: part.mediaType, data: part.base64 },
  };
}

export async function analyze(
  parts: FilePart[],
  pages: number,
): Promise<{ studySet: StudySet; usage: ModelUsage }> {
  const client = new Anthropic({ apiKey: env.anthropicApiKey });
  const model = env.model;

  // סטרימינג כדי שבקשה ארוכה לא תיפול על timeout של HTTP. התשובה נאספת
  // במלואה לפני שהיא מאומתת ונשמרת — לא מציגים טוקנים לתלמיד.
  const stream = client.messages.stream({
    model,
    // תקרה שמתאימה למנה של עד 6 עמודים. 64K היו מזמינים תשובה ארוכה
    // מדי בשביל תקציב הזמן של הפונקציה.
    max_tokens: 16_000,
    system: SYSTEM_PROMPT,
    output_config: {
      // 'medium' ולא 'high': effort הוא מה שקובע כמה זמן הקריאה רצה,
      // וקריאה שחורגת מ-150 שניות נהרגת ומחזירה אפס. סיכום טוב שנכתב
      // בזמן עדיף על סיכום מצוין שלא הגיע. אם יתברר שהאיכות נפגעה,
      // מעלים חזרה ומקטינים עוד את המנה.
      effort: 'medium',
      // המבנה נאכף בזמן הדגימה, לא מתבקש בפרומפט
      format: { type: 'json_schema', schema: studySetSchema },
    },
    messages: [
      {
        role: 'user',
        // הקבצים לפני הטקסט — כך המודל רואה את החומר לפני ההוראה
        content: [...parts.map(block), { type: 'text', text: userPrompt(pages) }],
      },
    ],
  });

  const message = await stream.finalMessage();

  if (message.stop_reason === 'refusal') {
    throw new UserError('לא הצלחנו לעבד את החומר הזה. נסה חומר אחר.');
  }
  if (
    message.stop_reason === 'max_tokens' ||
    message.stop_reason === 'model_context_window_exceeded'
  ) {
    throw new UserError('החומר ארוך מדי לעיבוד בפעם אחת. נסה להעלות פחות עמודים');
  }

  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  if (!text.trim()) throw new Error('המודל החזיר תשובה ריקה');

  const raw = {
    inputTokens: message.usage.input_tokens ?? 0,
    outputTokens: message.usage.output_tokens ?? 0,
    cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
  };

  const usage = { ...raw, costUsd: estimateCost(model, raw) };

  try {
    return { studySet: trimToBudgets(parseStudySet(JSON.parse(text)), pages), usage };
  } catch (error) {
    // הכשל קרה אחרי שהמודל כבר עבד. בלי הצמדת הצריכה לשגיאה הקריאה
    // נרשמת עם אפס טוקנים, והתקרה החודשית מפסיקה לשקף את ההוצאה.
    if (error instanceof StudySetError) error.usage = usage;
    throw error;
  }
}
