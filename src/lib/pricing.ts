/**
 * החבילות, לתצוגה. מקור האמת הוא טבלת `credit_packs` במסד — שינוי מחיר
 * שם הוא UPDATE בלי פריסה — והרשימה כאן היא העותק שהמסכים מציגים.
 * שתיהן חייבות להסכים, ולכן שינוי מחיר נעשה בשני המקומות.
 *
 * למה יחידות ולא מנוי: העלות שלנו היא לכל העלאה, והשימוש של תלמיד הוא
 * התפרצות לפני מבחן. מנוי גובה בשבועות השקטים וחוסם בשבוע העמוס.
 */
export type Pack = {
  slug: 'exam' | 'term' | 'bagrut';
  title: string;
  subtitle: string;
  uploads: number;
  priceAgorot: number;
  /** החבילה שמומלצת במסך. אחת בלבד. */
  featured?: boolean;
};

export const packs: Pack[] = [
  {
    slug: 'exam',
    title: 'מבחן אחד',
    subtitle: 'מספיק למבחן קרוב',
    uploads: 5,
    priceAgorot: 2900,
  },
  {
    slug: 'term',
    title: 'מחצית',
    subtitle: 'כמה מקצועות לאורך מחצית',
    uploads: 15,
    priceAgorot: 6900,
    featured: true,
  },
  {
    slug: 'bagrut',
    title: 'בגרות',
    subtitle: 'שנה שלמה של חומר',
    uploads: 40,
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

/** מחיר ליחידה, לתצוגת "כמה זה יוצא לחומר". */
export function perUploadDigits(pack: Pack): string {
  return (pack.priceAgorot / 100 / pack.uploads).toFixed(1).replace(/\.0$/, '');
}
