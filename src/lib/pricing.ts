/**
 * החבילות, לתצוגה. מקור האמת הוא טבלת `credit_packs` במסד — שינוי מחיר
 * שם הוא UPDATE בלי פריסה — והרשימה כאן היא העותק שהמסכים מציגים.
 * שתיהן חייבות להסכים, ולכן שינוי מחיר נעשה בשני המקומות.
 *
 * למה עמודים ולא מנוי, ולמה עמודים ולא העלאות: העלות שלנו נגזרת ממספר
 * העמודים שהמודל קורא, וקובץ טיפוסי הוא 20–60 עמודים. מכירה לפי
 * "העלאה" הייתה מוכרת 60 עמודים במחיר של 6.
 */
export type Pack = {
  slug: 'exam' | 'term' | 'bagrut';
  title: string;
  subtitle: string;
  /** היחידה היא עמוד, כי זה מה שעולה לנו כסף. */
  pages: number;
  priceAgorot: number;
  /** החבילה שמומלצת במסך. אחת בלבד. */
  featured?: boolean;
};

export const packs: Pack[] = [
  {
    slug: 'exam',
    title: 'מבחן אחד',
    subtitle: 'סיכום או שניים לפני מבחן',
    pages: 60,
    priceAgorot: 2900,
  },
  {
    slug: 'term',
    title: 'מחצית',
    subtitle: 'כמה מקצועות לאורך מחצית',
    pages: 180,
    priceAgorot: 6900,
    featured: true,
  },
  {
    slug: 'bagrut',
    title: 'בגרות',
    subtitle: 'שנה שלמה של חומר',
    pages: 450,
    priceAgorot: 14900,
  },
];

export function packBySlug(slug: string): Pack | null {
  return packs.find((pack) => pack.slug === slug) ?? null;
}

/** "29" — מספר בלבד, כדי שאפשר יהיה לעטוף אותו ב-.num בממשק עברי. */
export function priceDigits(pack: Pack): string {
  return String(Math.round(pack.priceAgorot / 100));
}

/** אגורות לעמוד, לתצוגת "כמה זה יוצא לעמוד". */
export function perPageDigits(pack: Pack): string {
  return String(Math.round(pack.priceAgorot / pack.pages));
}
