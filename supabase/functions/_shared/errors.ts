/**
 * מה מותר לתלמיד לראות.
 *
 * הודעת שגיאה גולמית היא גם חוויה גרועה וגם דליפה: "חסר משתנה סביבה:
 * ANTHROPIC_API_KEY" מספרת למי שמסתכל איך המערכת בנויה, ולא עוזרת לו
 * בכלום. לכן רק שגיאה שנזרקה במפורש כ-UserError מגיעה למסך; כל השאר
 * מקבלת הודעה כללית, והפירוט נשמר בלוג וב-model_calls.error.
 */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserError';
  }
}

/** ההודעה שמוצגת כשאין לנו מה להגיד לתלמיד. */
export const GENERIC_FAILURE =
  'העיבוד נכשל. זו תקלה אצלנו ולא בקובץ שלך — נסה שוב עוד כמה דקות.';

export function userMessage(error: unknown): string {
  return error instanceof UserError ? error.message : GENERIC_FAILURE;
}
