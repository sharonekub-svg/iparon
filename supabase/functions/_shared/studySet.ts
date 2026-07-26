/**
 * החוזה עם האפליקציה, זהה ל-src/types/study.ts.
 *
 * {
 *   "summary": "טקסט",
 *   "flashcards": [{"q": "...", "a": "..."}],
 *   "quiz": [{"q": "...", "options": ["...","...","...","..."], "correct": 0}]
 * }
 */

export type Flashcard = { q: string; a: string };
export type QuizQuestion = { q: string; options: string[]; correct: number };
export type StudySet = { summary: string; flashcards: Flashcard[]; quiz: QuizQuestion[] };

/**
 * הסכימה שנשלחת ל-Structured Outputs. היא מכריחה את המודל להחזיר את
 * המבנה הזה בדיוק — לא בקשה בפרומפט אלא אילוץ בזמן הדגימה.
 *
 * מגבלות הסכימה: אין minimum/maximum, אין minItems, ו-additionalProperties
 * חייב להיות false. לכן טווח ה-correct ואורך המערכים נבדקים בקוד, למטה.
 */
export const studySetSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description: "סיכום מסודר של החומר, בעברית, בפסקאות קצרות",
    },
    flashcards: {
      type: "array",
      description: "כרטיסיות שאלה־תשובה על החומר",
      items: {
        type: "object",
        properties: {
          q: { type: "string", description: "השאלה, בעברית" },
          a: { type: "string", description: "התשובה, בעברית" },
        },
        required: ["q", "a"],
        additionalProperties: false,
      },
    },
    quiz: {
      type: "array",
      description: "שאלות רבות־ברירה על החומר",
      items: {
        type: "object",
        properties: {
          q: { type: "string", description: "השאלה, בעברית" },
          options: {
            type: "array",
            description: "בדיוק ארבע תשובות אפשריות, בעברית",
            items: { type: "string" },
          },
          correct: {
            type: "integer",
            description: "האינדקס של התשובה הנכונה ב-options, מ-0 עד 3",
          },
        },
        required: ["q", "options", "correct"],
        additionalProperties: false,
      },
    },
  },
  required: ["summary", "flashcards", "quiz"],
  additionalProperties: false,
};

export class StudySetError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "StudySetError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFilledString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Structured Outputs מבטיח את המבנה, אבל לא את התוכן: הוא לא מונע מערך
 * ריק, מחרוזת ריקה, או correct מחוץ לטווח. לכן יש ולידציה גם כאן,
 * לפני שהתוצאה נשמרת ומוצגת לתלמיד.
 */
export function parseStudySet(value: unknown): StudySet {
  if (!isRecord(value)) {
    throw new StudySetError("הגוף אינו אובייקט");
  }

  if (!isFilledString(value.summary)) {
    throw new StudySetError("summary חסר או ריק");
  }

  if (!Array.isArray(value.flashcards) || value.flashcards.length === 0) {
    throw new StudySetError("flashcards ריק");
  }

  const flashcards = value.flashcards.map((card, index) => {
    if (!isRecord(card) || !isFilledString(card.q) || !isFilledString(card.a)) {
      throw new StudySetError(`כרטיסייה ${index} חסרה q או a`);
    }
    return { q: card.q, a: card.a };
  });

  if (!Array.isArray(value.quiz) || value.quiz.length === 0) {
    throw new StudySetError("quiz ריק");
  }

  const quiz = value.quiz.map((question, index) => {
    if (!isRecord(question) || !isFilledString(question.q)) {
      throw new StudySetError(`שאלה ${index} חסרה q`);
    }

    if (!Array.isArray(question.options) || question.options.length < 2) {
      throw new StudySetError(`שאלה ${index} חסרה תשובות`);
    }

    const options = question.options.map((option, optionIndex) => {
      if (!isFilledString(option)) {
        throw new StudySetError(`שאלה ${index}, תשובה ${optionIndex} ריקה`);
      }
      return option;
    });

    const { correct } = question;
    if (
      typeof correct !== "number" ||
      !Number.isInteger(correct) ||
      correct < 0 ||
      correct >= options.length
    ) {
      throw new StudySetError(`שאלה ${index}: correct מחוץ לטווח`);
    }

    return { q: question.q, options, correct };
  });

  return { summary: value.summary, flashcards, quiz };
}
