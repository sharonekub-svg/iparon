import { createBrowserClient } from '@supabase/ssr';

import { supabasePublishableKey, supabaseUrl } from '@/lib/env';

/**
 * לקוח לדפדפן. מחזיק רק את המפתח הציבורי, ולכן כל מה שהוא יכול לעשות
 * מוגבל על ידי ה-RLS. הוא נוצר לפי דרישה ולא ברמת המודול, כדי ש-`next build`
 * לא ייגע בו בזמן רינדור מראש.
 */
export function createBrowserSupabase() {
  return createBrowserClient(supabaseUrl(), supabasePublishableKey());
}
