/**
 * נורמליזציה של קוד הפעלה.
 *
 * הקוד מוכתב בוואטסאפ ומוקלד בטלפון: רווחים, אותיות קטנות ומקף חסר
 * הם ברירת המחדל ולא החריג. מי שהקליד נכון במהותו לא צריך לקבל
 * "הקוד לא קיים".
 */
export function normalizeRedeemCode(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase();
}

/** בדיקה מקדימה בלבד. הקובע הוא המסד. */
export function looksLikeRedeemCode(raw: string): boolean {
  const code = normalizeRedeemCode(raw);
  return code.length >= 8 && code.length <= 32 && /^[A-Z0-9-]+$/.test(code);
}
