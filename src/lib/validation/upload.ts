/** מגבלות הקלט. חייבות להישאר תואמות ל-supabase/functions/_shared/env.ts */
export const uploadLimits = {
  maxFileBytes: 15 * 1024 * 1024,
  maxTotalBytes: 25 * 1024 * 1024,
  maxFiles: 20,
} as const;

export const acceptedTypes = ['application/pdf', 'image/jpeg', 'image/png'] as const;

export type AcceptedType = (typeof acceptedTypes)[number];

export function isAcceptedType(value: string): value is AcceptedType {
  return (acceptedTypes as readonly string[]).includes(value);
}

export function extensionFor(type: AcceptedType): string {
  return type === 'application/pdf' ? 'pdf' : type === 'image/png' ? 'png' : 'jpg';
}

/**
 * הבדיקה בדפדפן היא UX בלבד. הבדיקה שקובעת היא ב-Storage (סוג וגודל)
 * ובעובד (magic bytes) — שם הלקוח כבר לא שולט.
 */
export function describeRejection(
  files: { name: string; size: number; type: string }[],
): string | null {
  if (files.length === 0) return 'לא נבחר קובץ';
  if (files.length > uploadLimits.maxFiles) {
    return `אפשר להעלות עד ${uploadLimits.maxFiles} עמודים בפעם אחת`;
  }

  const pdfCount = files.filter((f) => f.type === 'application/pdf').length;
  if (pdfCount > 1) return 'אפשר להעלות קובץ PDF אחד בכל פעם';
  if (pdfCount === 1 && files.length > 1) {
    return 'אפשר להעלות PDF אחד, או כמה תמונות — לא ערבוב';
  }

  for (const file of files) {
    if (!isAcceptedType(file.type)) return 'אפשר להעלות PDF, JPG או PNG בלבד';
    if (file.size > uploadLimits.maxFileBytes) {
      return `הקובץ "${file.name}" גדול מ-15MB`;
    }
  }

  const total = files.reduce((sum, f) => sum + f.size, 0);
  if (total > uploadLimits.maxTotalBytes) {
    return 'סך הקבצים גדול מדי. נסה להעלות פחות עמודים';
  }

  return null;
}
