import { NextResponse, type NextRequest } from 'next/server';

import { createServerClient } from '@supabase/ssr';

import { supabasePublishableKey, supabaseUrl } from '@/lib/env';

/**
 * ‼️ ב-Next 16 הקובץ הזה נקרא proxy.ts והפונקציה נקראת proxy.
 * `middleware.ts` הוחלף. קובץ בשם הישן לא ירוץ — בלי שגיאה ובלי אזהרה,
 * כלומר הגנת מסלולים שנראית קיימת ואיננה.
 *
 * שני תפקידים:
 *   1. רענון ה-session בכל בקשה, וכתיבת ה-cookies המרועננים לתשובה.
 *   2. חסימת האזור המוגן בפני מי שלא מחובר.
 */

/** מסלולים שדורשים משתמש מחובר */
const PROTECTED = ['/dashboard', '/upload', '/sets'];

/** מסלולים שאין טעם להציג למי שכבר מחובר */
const AUTH_ONLY = ['/login', '/signup'];

function startsWithAny(pathname: string, prefixes: string[]): boolean {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // כותרות ה-no-cache שהספרייה מספקת. בלעדיהן CDN או פרוקסי
        // עלול לשמור בזיכרון תשובה שמכילה cookie של session ולהגיש
        // אותה למשתמש אחר.
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // getUser ולא getSession: getSession קורא את ה-JWT מה-cookie בלי
  // לאמת אותו מול השרת, ו-cookie אפשר לזייף.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && startsWithAny(pathname, PROTECTED)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    // כדי להחזיר אותו לאן שרצה להגיע, אחרי ההתחברות
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (user && startsWithAny(pathname, AUTH_ONLY)) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * כל בקשה חוץ מנכסים סטטיים וקבצי תמונה. חשוב שהרענון ירוץ גם על
     * מסלולים ציבוריים — אחרת session שפג לא מתרענן עד שהמשתמש במקרה
     * נכנס לאזור המוגן.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
