import { cookies } from 'next/headers';

import { createServerClient } from '@supabase/ssr';

import { supabasePublishableKey, supabaseUrl } from '@/lib/env';

/**
 * לקוח לשרת — Server Components, Server Actions ו-Route Handlers.
 * פועל בזהות המשתמש המחובר, ולכן RLS חלה עליו במלואה.
 */
export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component לא יכול לכתוב cookies. זה בסדר: רענון
          // ה-session נעשה ב-proxy.ts, שרץ לפני כל בקשה.
        }
      },
    },
  });
}
