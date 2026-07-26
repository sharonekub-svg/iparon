import Anthropic from "npm:@anthropic-ai/sdk@0.115.0";

import { env } from "./env.ts";
import { parseStudySet, studySetSchema, type StudySet } from "./studySet.ts";

/**
 * כלל ברזל 3: בלי OCR ובלי חילוץ טקסט מ-PDF.
 * עברית נשברת בשתי הדרכים — כתב יד לא מזוהה, ו-PDF עברי מחזיר טקסט הפוך
 * ומשובש. הקובץ נשלח כמו שהוא למודל ראייה: PDF כבלוק document, שבו המודל
 * רואה כל עמוד כתמונה, וצילום כבלוק image.
 */
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;

export type SupportedMediaType = "application/pdf" | (typeof IMAGE_TYPES)[number];

export function isSupportedMediaType(value: string): value is SupportedMediaType {
  return value === "application/pdf" || (IMAGE_TYPES as readonly string[]).includes(value);
}

/** כלל ברזל 6 — כל ההגבלות נאמרות למודל במפורש, ולא נשענות על ברירת מחדל. */
const SYSTEM_PROMPT = `אתה עוזר לימוד לתלמידי תיכון בישראל.

מגיע אליך חומר לימוד: סיכום, דף מחברת, או פרק מספר. התפקיד שלך הוא להפוך אותו
לשלושה דברים: סיכום מסודר, כרטיסיות שאלה־תשובה, וקוויז אמריקאי.

כללים מחייבים:
1. כל הפלט בעברית. כל שדה, כל שאלה, כל תשובה. אין יוצא מן הכלל.
2. השתמש אך ורק במידע שמופיע בחומר שהועלה. אל תוסיף ידע חיצוני, גם אם אתה
   יודע את התשובה ממקום אחר, וגם אם החומר חלקי או שגוי.
3. אל תמציא. אם משהו בחומר לא קריא או לא ברור, פשוט אל תכלול אותו. עדיף פחות
   כרטיסיות נכונות מכרטיסייה אחת שהומצאה.
4. אם החומר קצר, החזר פחות פריטים. אל תמתח אותו ואל תמלא במילים.

הסיכום: פסקאות קצרות שמסבירות את החומר בסדר הגיוני, במונחים שמופיעים בחומר
עצמו. בלי הקדמות ובלי "בסיכום זה נלמד".

הכרטיסיות: שאלה אחת ממוקדת וקצרה, ותשובה מדויקת. 10 עד 25 כרטיסיות, לפי כמות
החומר. שאלה על מושג אחד בכל כרטיסייה.

הקוויז: 5 עד 12 שאלות, כל אחת עם בדיוק ארבע תשובות אפשריות ותשובה אחת נכונה.
שלוש התשובות השגויות צריכות להיות סבירות ומבוססות על החומר, לא אבסורדיות —
מסיח דעת טוב הוא טעות שתלמיד באמת עושה. פזר את מקום התשובה הנכונה בין השאלות.`;

const USER_PROMPT = `זה החומר. החזר סיכום, כרטיסיות וקוויז לפי הכללים — בעברית,
ורק ממה שמופיע כאן.`;

type ModelUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  costUsd: number;
};

export type AnalyzeResult = {
  studySet: StudySet;
  usage: ModelUsage;
};

/** דולר למיליון טוקנים. קריאה מהמאגר היא כעשירית ממחיר הקלט. */
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-5": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

function estimateCost(model: string, usage: Omit<ModelUsage, "costUsd">): number {
  const rate = PRICING[model] ?? PRICING["claude-opus-5"];
  return (
    (usage.inputTokens * rate.input +
      usage.outputTokens * rate.output +
      usage.cacheReadTokens * rate.input * 0.1) /
    1_000_000
  );
}

function fileBlock(mediaType: SupportedMediaType, base64: string) {
  if (mediaType === "application/pdf") {
    return {
      type: "document" as const,
      source: { type: "base64" as const, media_type: mediaType, data: base64 },
    };
  }

  return {
    type: "image" as const,
    source: { type: "base64" as const, media_type: mediaType, data: base64 },
  };
}

export async function analyzeMaterial(
  mediaType: SupportedMediaType,
  base64: string,
): Promise<AnalyzeResult> {
  const client = new Anthropic({ apiKey: env.anthropicApiKey });
  const model = env.model;

  // סטרימינג כדי שבקשה ארוכה לא תיפול על timeout של HTTP, ולא בשביל
  // להציג טוקנים — התשובה נאספת במלואה לפני שהיא מאומתת ונשמרת.
  const stream = client.messages.stream({
    model,
    max_tokens: 32_000,
    system: SYSTEM_PROMPT,
    output_config: {
      // מספיק למשימה של הבנת דף וכתיבת שאלות, וחוסך זמן וטוקנים
      effort: "medium",
      // כלל ברזל 5: המבנה נאכף בזמן הדגימה, לא מתבקש בפרומפט
      format: { type: "json_schema", schema: studySetSchema },
    },
    messages: [
      {
        role: "user",
        // הקובץ לפני הטקסט — כך המודל רואה את החומר לפני ההוראה
        content: [fileBlock(mediaType, base64), { type: "text", text: USER_PROMPT }],
      },
    ],
  });

  const message = await stream.finalMessage();

  if (message.stop_reason === "refusal") {
    throw new Error("המודל סירב לעבד את החומר הזה");
  }

  if (message.stop_reason === "max_tokens" || message.stop_reason === "model_context_window_exceeded") {
    throw new Error("החומר ארוך מדי לעיבוד בפעם אחת. נסה להעלות פחות עמודים");
  }

  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  if (!text.trim()) {
    throw new Error("המודל החזיר תשובה ריקה");
  }

  const rawUsage = {
    inputTokens: message.usage.input_tokens ?? 0,
    outputTokens: message.usage.output_tokens ?? 0,
    cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
  };

  return {
    studySet: parseStudySet(JSON.parse(text)),
    usage: { ...rawUsage, costUsd: estimateCost(model, rawUsage) },
  };
}

export { env as modelEnv };
