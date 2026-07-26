/**
 * כלל ברזל 5: החוזה היחיד בין ה־Edge Function לאפליקציה.
 * הפונקציה מחזירה JSON בלבד, במבנה הזה בדיוק:
 *
 * {
 *   "summary": "טקסט",
 *   "flashcards": [{"q": "...", "a": "..."}],
 *   "quiz": [{"q": "...", "options": ["...","...","...","..."], "correct": 0}]
 * }
 */

export type Flashcard = {
  q: string;
  a: string;
};

export type QuizQuestion = {
  q: string;
  options: string[];
  correct: number;
};

export type StudySet = {
  summary: string;
  flashcards: Flashcard[];
  quiz: QuizQuestion[];
};

export class StudySetParseError extends Error {
  constructor(reason: string) {
    super(`תשובת השרת לא במבנה הצפוי: ${reason}`);
    this.name = 'StudySetParseError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * ולידציה בזמן ריצה על מה שחוזר מהפונקציה.
 * מודל יכול לחזור עם JSON חסר או מעוות — האפליקציה לא סומכת עליו בעיניים עצומות.
 */
export function parseStudySet(value: unknown): StudySet {
  if (!isRecord(value)) {
    throw new StudySetParseError('הגוף אינו אובייקט');
  }

  if (!isNonEmptyString(value.summary)) {
    throw new StudySetParseError('summary חסר או ריק');
  }

  if (!Array.isArray(value.flashcards)) {
    throw new StudySetParseError('flashcards אינו מערך');
  }

  const flashcards: Flashcard[] = value.flashcards.map((card, index) => {
    if (!isRecord(card) || !isNonEmptyString(card.q) || !isNonEmptyString(card.a)) {
      throw new StudySetParseError(`כרטיסייה ${index} חסרה q או a`);
    }
    return { q: card.q, a: card.a };
  });

  if (!Array.isArray(value.quiz)) {
    throw new StudySetParseError('quiz אינו מערך');
  }

  const quiz: QuizQuestion[] = value.quiz.map((question, index) => {
    if (!isRecord(question) || !isNonEmptyString(question.q)) {
      throw new StudySetParseError(`שאלה ${index} חסרה q`);
    }

    if (!Array.isArray(question.options) || question.options.length < 2) {
      throw new StudySetParseError(`שאלה ${index} חסרה options`);
    }

    const options = question.options.map((option, optionIndex) => {
      if (!isNonEmptyString(option)) {
        throw new StudySetParseError(`שאלה ${index}, תשובה ${optionIndex} ריקה`);
      }
      return option;
    });

    const correct = question.correct;
    if (typeof correct !== 'number' || !Number.isInteger(correct) || correct < 0 || correct >= options.length) {
      throw new StudySetParseError(`שאלה ${index}: correct מחוץ לטווח`);
    }

    return { q: question.q, options, correct };
  });

  return { summary: value.summary, flashcards, quiz };
}
