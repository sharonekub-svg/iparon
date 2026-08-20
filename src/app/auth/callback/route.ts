import { NextResponse, type NextRequest } from 'next/server';

import { siteUrl } from '@/lib/env';
import { createServerSupabase } from '@/lib/supabase/server';
import { safeRedirectPath } from '@/lib/validation/auth';

/**
 * חזרה מ-OAuth ומקישור אישור האימייל.
 *
 * ספק ה-OAuth מחזיר `code` חד־פעמי, וכאן הוא מוחלף ל-session אמיתי.
 * הכתובת הזאת היא מה שצריך להיות רשום ב-Redirect URI אצל הספק:
 *   https://<פרויקט>.supabase.co/auth/v1/callback  ← אצל Google
 *   https://<הדומיין שלנו>/auth/callback           ← אצל Supabase
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  // בייצור מאחורי פרוקסי, origin של הבקשה יכול להיות של הפרוקסי
  // ולא של האתר. NEXT_PUBLIC_SITE_URL הוא המקור האמין.
  const base = process.env.NEXT_PUBLIC_SITE_URL ? siteUrl() : request.nextUrl.origin;

  const code = searchParams.get('code');
  const next = safeRedirectPath(searchParams.get('next'));

  if (!code) {
    return NextResponse.redirect(`${base}/login?error=auth`);
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${base}/login?error=auth`);
  }

  return NextResponse.redirect(`${base}${next}`);
}
