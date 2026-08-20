import { z } from 'zod';

/**
 * ולידציה על קלט המשתמש. רצה בשרת — ולידציה בדפדפן היא נוחות, לא הגנה.
 */

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'צריך למלא כתובת אימייל')
  .email('כתובת האימייל לא נראית תקינה');

export const passwordSchema = z
  .string()
  .min(8, 'הסיסמה צריכה להיות באורך 8 תווים לפחות')
  .max(72, 'הסיסמה ארוכה מדי');

export const credentialsSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const signUpSchema = credentialsSchema.extend({
  displayName: z
    .string()
    .trim()
    .max(80, 'השם ארוך מדי')
    .optional()
    .transform((value) => (value ? value : undefined)),
});

/**
 * יעד ההפניה אחרי התחברות.
 *
 * מקבל רק נתיב יחסי. `//evil.com` ו-`https://evil.com` הם כתובות
 * חיצוניות שהדפדפן ילך אליהן — פרמטר next שלא נבדק הוא open redirect,
 * וזה וקטור פישינג קלאסי: קישור שנראה כמו האתר שלנו ומעביר לאתר אחר.
 */
export function safeRedirectPath(value: string | null | undefined): string {
  if (!value) return '/dashboard';
  if (!value.startsWith('/')) return '/dashboard';
  if (value.startsWith('//')) return '/dashboard';
  return value;
}
