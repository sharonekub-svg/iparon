/**
 * משתני הסביבה הציבוריים, מאומתים בנקודת השימוש.
 *
 * הקריאה עצלה בכוונה: `next build` מרנדר מראש דפים שלא נוגעים ב-Supabase,
 * ובנייה לא צריכה ליפול רק כי אין עדיין `.env.local`. מי שכן צריך את
 * הערכים מקבל שגיאה ברורה בזמן ריצה במקום `undefined` שמתגלגל הלאה.
 */

function required(name: string, value: string | undefined): string {
  if (!value || !value.trim()) {
    throw new Error(`חסר משתנה סביבה: ${name}. ראה .env.example והעתק ל-.env.local.`);
  }
  return value;
}

export function supabaseUrl(): string {
  return required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function supabasePublishableKey(): string {
  return required(
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

/**
 * מפתח service role. עוקף RLS, ולכן אסור לו לצאת מהשרת.
 * הבדיקה כאן היא רשת ביטחון: אם מישהו ייבא את זה לקוד לקוח,
 * ה-bundle של הדפדפן לא מכיל את המשתנה והקריאה תיפול מיד.
 */
export function supabaseServiceRoleKey(): string {
  return required('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';
}

/**
 * כפתור "דלג" למסכי ההרשמה והכניסה.
 *
 * דלוק כברירת מחדל בזמן הבטא, כדי שאפשר יהיה לראות את המוצר בלי
 * לפתוח חשבון. כיבוי: NEXT_PUBLIC_DEMO_LOGIN=0 — משתנה סביבה, בלי
 * שינוי קוד ובלי פריסה של גרסה אחרת.
 */
export function demoLoginEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_LOGIN !== '0';
}

/**
 * כתובת ליצירת קשר לרכישה. כל ערוץ מתאים — `https://wa.me/9725...`,
 * `mailto:...`, קישור לאינסטגרם.
 *
 * כל עוד הסליקה לא פתוחה, זה מסלול הרכישה היחיד: התלמיד כותב, מעביר
 * תשלום, ומקבל קוד הפעלה. בלי הערך הזה לא מוצג כפתור יצירת קשר —
 * עדיף בלי כפתור מאשר כפתור שלא מוביל לאף אחד.
 */
export function contactUrl(): string | null {
  const value = process.env.NEXT_PUBLIC_CONTACT_URL?.trim();
  return value ? value : null;
}
