import Anthropic from 'npm:@anthropic-ai/sdk@0.115.0';

import { env } from './env.ts';
import { parseStudySet, studySetSchema, type StudySet } from './studySet.ts';

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

הנושאים: 2 עד 8 נושאים שבאמת מופיעים בחומר. כל שאר הפריטים משויכים לאחד
מהם בשדה topic, במחרוזת זהה בדיוק לאחד מהנושאים ברשימה.

הסיכום: פסקאות קצרות שמסבירות את החומר בסדר הגיוני, במונחים שמופיעים בחומר
עצמו. הפרד בין פסקאות בשורה ריקה כפולה. בלי הקדמות ובלי "בסיכום זה נלמד".

הכרטיסיות: שאלה אחת ממוקדת וקצרה, ותשובה מדויקת. מושג אחד בכל כרטיסייה.

שאלות התרגול ושאלות המבחן: כל אחת עם בדיוק ארבע תשובות ותשובה נכונה אחת.
שלוש התשובות השגויות צריכות להיות סבירות ומבוססות על החומר, לא אבסורדיות —
מסיח דעת טוב הוא טעות שתלמיד באמת עושה. פזר את מקום התשובה הנכונה בין
השאלות. שאלות המבחן צריכות לכסות את כל הנושאים, כדי שאפשר יהיה להיבחן על
נושא בודד.`;

const USER_PROMPT = `זה החומר. החזר את חומר הלימוד לפי הכללים — בעברית, ורק ממה שמופיע כאן.`;

export type ModelUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  costUsd: number;
};

/** דולר למיליון טוקנים. קריאה מהמאגר היא כעשירית ממחיר הקלט. */
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-5': { input: 5, output: 25 },
  'claude-sonnet-5': { input: 3, output: 15 },
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
): Promise<{ studySet: StudySet; usage: ModelUsage }> {
  const client = new Anthropic({ apiKey: env.anthropicApiKey });
  const model = env.model;

  // סטרימינג כדי שבקשה ארוכה לא תיפול על timeout של HTTP. התשובה נאספת
  // במלואה לפני שהיא מאומתת ונשמרת — לא מציגים טוקנים לתלמיד.
  const stream = client.messages.stream({
    model,
    max_tokens: 32_000,
    system: SYSTEM_PROMPT,
    output_config: {
      // מספיק להבנת דף וכתיבת שאלות, וחוסך זמן וטוקנים
      effort: 'medium',
      // המבנה נאכף בזמן הדגימה, לא מתבקש בפרומפט
      format: { type: 'json_schema', schema: studySetSchema },
    },
    messages: [
      {
        role: 'user',
        // הקבצים לפני הטקסט — כך המודל רואה את החומר לפני ההוראה
        content: [...parts.map(block), { type: 'text', text: USER_PROMPT }],
      },
    ],
  });

  const message = await stream.finalMessage();

  if (message.stop_reason === 'refusal') {
    throw new Error('המודל סירב לעבד את החומר הזה');
  }
  if (
    message.stop_reason === 'max_tokens' ||
    message.stop_reason === 'model_context_window_exceeded'
  ) {
    throw new Error('החומר ארוך מדי לעיבוד בפעם אחת. נסה להעלות פחות עמודים');
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

  return {
    studySet: parseStudySet(JSON.parse(text)),
    usage: { ...raw, costUsd: estimateCost(model, raw) },
  };
}
