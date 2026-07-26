/**
 * כלל ברזל 1: מפתח ה־API של המודל נמצא רק ב־Secrets של ה־Edge Function.
 * כאן יושבים רק ערכים שמותר להם להיות במכשיר של התלמיד:
 * כתובת הפרויקט ומפתח anon ציבורי.
 */

export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  /** EXPO_PUBLIC_SEED_DEMO=1 מציג חומרי הדגמה במסך הבית בזמן פיתוח */
  seedDemoData: process.env.EXPO_PUBLIC_SEED_DEMO === '1',
} as const;

const FORBIDDEN_KEY_PATTERNS = [/ANTHROPIC/i, /OPENAI/i, /GEMINI/i, /SERVICE_ROLE/i, /SECRET/i];

/**
 * שומר על כלל ברזל 1 בזמן פיתוח: כל משתנה EXPO_PUBLIC_* נארז לתוך
 * החבילה ונגיש לכל מי שמחזיק אותה. אם מפתח מודל נכנס לשם — נשמע רעש מיד.
 */
export function assertNoModelKeyInApp(): void {
  if (!__DEV__) {
    return;
  }

  const leaked = Object.keys(process.env)
    .filter((key) => key.startsWith('EXPO_PUBLIC_'))
    .filter((key) => FORBIDDEN_KEY_PATTERNS.some((pattern) => pattern.test(key)));

  if (leaked.length > 0) {
    throw new Error(
      `מפתחות אסורים בקוד האפליקציה: ${leaked.join(', ')}. ` +
        'מפתח המודל נכנס ל־Secrets של ה־Edge Function בלבד.',
    );
  }
}
