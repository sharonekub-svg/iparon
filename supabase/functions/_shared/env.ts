/**
 * משתני הסביבה של העובד.
 *
 * SUPABASE_URL ו-SUPABASE_SERVICE_ROLE_KEY מוזרקים אוטומטית לפונקציות
 * ואין צורך להגדיר אותם. ANTHROPIC_API_KEY נקבע ידנית:
 *   npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
 *
 * כלל ברזל 1: המפתח קיים כאן ורק כאן. אין לו זכר בקוד האתר.
 */

function required(name: string): string {
  const value = Deno.env.get(name);
  if (!value || !value.trim()) {
    throw new Error(`חסר משתנה סביבה: ${name}`);
  }
  return value;
}

export const env = {
  get supabaseUrl() {
    return required('SUPABASE_URL');
  },
  get serviceRoleKey() {
    return required('SUPABASE_SERVICE_ROLE_KEY');
  },
  get anthropicApiKey() {
    return required('ANTHROPIC_API_KEY');
  },
  /** ניתן להחלפה בלי לפרוס מחדש: supabase secrets set LAMDAI_MODEL=... */
  get model() {
    return Deno.env.get('LAMDAI_MODEL') ?? 'claude-opus-5';
  },
};

/** מגבלות הקלט. מתועדות ב-docs/PLAN.md סעיף 7. */
export const limits = {
  maxFileBytes: 15 * 1024 * 1024,
  maxTotalBytes: 25 * 1024 * 1024,
  maxFiles: 20,
  /**
   * עמודים למנת עיבוד אחת. קובץ גדול יותר לא נדחה — הוא מפוצל למנות,
   * כל מנה בהפעלה נפרדת של הפונקציה. הגבול הזה הוא גם תקציב זמן
   * להפעלה אחת וגם מה שמונע סיכום רדוד על חומר עצום.
   *
   * **המספר הזה נקבע על ידי מגבלת הזמן, לא על ידי העלות.** Supabase
   * הורגת Edge Function אחרי ~150 שניות, וקריאה על 13 עמודים ב-Opus
   * לקחה יותר מזה — הפונקציה מתה באמצע והתלמיד נשאר מול מסך תקוע.
   * כל מנה חייבת להסתיים בתוך התקציב הזה, ולכל הפעלה יש תקציב משלה.
   *
   * העלות מושכת לכיוון ההפוך (הפלט כמעט קבוע לכל קריאה, ולכן מנה
   * נוספת עולה כמעט כמו מלאה), אבל מנה שלא מסתיימת עולה את מלוא
   * המחיר ולא מחזירה כלום. הזמן מנצח.
   */
  maxPagesPerChunk: 6,
  /** גבול עליון לחומר אחד. מעליו מבקשים מהתלמיד לפצל בעצמו. */
  maxPages: 120,
} as const;
