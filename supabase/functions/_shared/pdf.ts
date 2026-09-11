import { PDFDocument } from 'npm:pdf-lib@1.17.1';

import { UserError } from './errors.ts';

/**
 * ספירת עמודים ב-PDF, לפני שהוא נשלח למודל.
 *
 * המגבלה שהייתה כאן קודם הייתה על **מספר קבצים** ולא על מספר עמודים,
 * וזה חור אמיתי: PDF בודד של 15MB יכול להכיל מאות עמודים, וכולם היו
 * נשלחים בקריאה אחת. הספירה נעשית לפני הקריאה למודל, ולכן דחייה לא
 * עולה כלום.
 */
export async function countPdfPages(bytes: Uint8Array): Promise<number> {
  return (await load(bytes)).getPageCount();
}

/**
 * חיתוך טווח עמודים ל-PDF חדש.
 *
 * זה הלב של עיבוד במנות: קובץ של 60 עמודים נשלח בשלוש קריאות של 20,
 * ולא בקריאה אחת שגם חורגת מזמן הפונקציה וגם מחזירה סיכום רדוד על
 * חומר עצום.
 *
 * `from` כולל, `to` לא כולל. שניהם מבוססי אפס.
 */
export async function slicePdf(
  bytes: Uint8Array,
  from: number,
  to: number,
): Promise<Uint8Array> {
  const source = await load(bytes);
  const total = source.getPageCount();
  const start = Math.max(0, from);
  const end = Math.min(total, to);

  if (start >= end) throw new UserError('טווח העמודים בקובץ אינו תקין');

  // מסמך שלם שמבקשים ממנו את כל עמודיו — אין מה לחתוך, וחיתוך מיותר
  // רק מסכן קבצים עם מבנה חריג.
  if (start === 0 && end === total) return bytes;

  const target = await PDFDocument.create();
  const indices = Array.from({ length: end - start }, (_, i) => start + i);
  const copied = await target.copyPages(source, indices);
  for (const page of copied) target.addPage(page);

  return await target.save();
}

async function load(bytes: Uint8Array): Promise<PDFDocument> {
  try {
    // ignoreEncryption: קובץ מוגן עדיין ניתן לספירת עמודים, והמודל
    // ייכשל עליו בהמשך עם הודעה משלו.
    return await PDFDocument.load(bytes, { ignoreEncryption: true });
  } catch {
    throw new UserError('לא הצלחנו לקרוא את ה-PDF. ייתכן שהוא פגום או מוגן בסיסמה');
  }
}
