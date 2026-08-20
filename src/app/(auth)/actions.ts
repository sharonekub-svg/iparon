'use server';

import { redirect } from 'next/navigation';

import { createServerSupabase } from '@/lib/supabase/server';
import { credentialsSchema, safeRedirectPath, signUpSchema } from '@/lib/validation/auth';

export type AuthState = {
  error?: string;
  notice?: string;
};

/**
 * הודעות השגיאה של Supabase מגיעות באנגלית ומכוונות למפתח.
 * התלמיד מקבל עברית, ובלי לחשוף אם האימייל קיים במערכת — הפרדה בין
 * "אין משתמש כזה" ל"סיסמה שגויה" היא דרך למנות משתמשים רשומים.
 */
function friendlyAuthError(context: string, error: { message: string }): string {
  // הפירוט לוג בלבד. בלעדיו כל תקלה — רשת חסומה, פרויקט מושהה, מפתח
  // שגוי — נראית למפתח בדיוק כמו סיסמה שגויה, וזה מבזבז שעות.
  console.error(`[auth:${context}]`, error.message);

  const m = error.message.toLowerCase();
  if (m.includes('invalid login credentials')) {
    return 'האימייל או הסיסמה לא נכונים';
  }
  if (m.includes('email not confirmed')) {
    return 'צריך לאשר את כתובת האימייל. שלחנו לך קישור.';
  }
  if (m.includes('already registered') || m.includes('already been registered')) {
    return 'כבר קיים חשבון עם האימייל הזה. אפשר להתחבר.';
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'יותר מדי ניסיונות. נסה שוב בעוד כמה דקות.';
  }
  if (m.includes('is invalid') && m.includes('email')) {
    return 'כתובת האימייל לא נראית תקינה';
  }
  if (m.includes('weak password')) {
    return 'הסיסמה חלשה מדי. נסה סיסמה ארוכה יותר.';
  }
  return 'משהו השתבש. נסה שוב.';
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'הפרטים לא תקינים' };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: friendlyAuthError('signIn', error) };
  }

  redirect(safeRedirectPath(formData.get('next')?.toString()));
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    displayName: formData.get('displayName'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'הפרטים לא תקינים' };
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: parsed.data.displayName
      ? { data: { full_name: parsed.data.displayName } }
      : undefined,
  });

  if (error) {
    return { error: friendlyAuthError('signUp', error) };
  }

  // כשאישור אימייל כבוי, Supabase מחזירה session מיד והמשתמש נכנס.
  // כשהוא דלוק, אין session והמשתמש צריך ללחוץ על הקישור במייל.
  // הקוד תומך בשני המצבים, כדי שהחלפת ההגדרה בקונסולה לא תשבור כלום.
  if (data.session) {
    redirect('/dashboard');
  }

  return {
    notice: 'שלחנו קישור אישור לאימייל שלך. אחרי הלחיצה עליו אפשר להתחבר.',
  };
}

export async function signOut(): Promise<void> {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect('/');
}
