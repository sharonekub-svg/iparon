import { PDFDocument } from 'npm:pdf-lib@1.17.1';

/**
 * ספירת עמודים ב-PDF, לפני שהוא נשלח למודל.
 *
 * המגבלה שהייתה כאן קודם הייתה על **מספר קבצים** ולא על מספר עמודים,
 * וזה חור אמיתי: PDF בודד של 15MB יכול להכיל מאות עמודים, וכולם היו
 * נשלחים בקריאה אחת. זה גם יקר בטוקנים באופן קיצוני, גם עלול לעבור
 * את מגבלת הזמן של הפונקציה, וגם יכול לשרוף את התקרה החודשית
 * בהעלאה אחת.
 *
 * הספירה נעשית לפני הקריאה למודל, ולכן דחייה לא עולה כלום.
 */
export async function countPdfPages(bytes: Uint8Array): Promise<number> {
  try {
    // ignoreEncryption: קובץ מוגן עדיין ניתן לספירת עמודים, והמודל
    // ייכשל עליו בהמשך עם הודעה משלו.
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    return doc.getPageCount();
  } catch {
    throw new Error('לא הצלחנו לקרוא את ה-PDF. ייתכן שהוא פגום או מוגן בסיסמה');
  }
}
