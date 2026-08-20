import 'server-only';

import { createClient } from '@supabase/supabase-js';

import { supabaseServiceRoleKey, supabaseUrl } from '@/lib/env';

/**
 * לקוח עם service role. **עוקף RLS.**
 *
 * `server-only` בראש הקובץ הוא הבלם: ייבוא שלו מקוד לקוח נכשל בזמן
 * הבנייה ולא בזמן ריצה בייצור.
 *
 * משמש רק למה שהמשתמש לא רשאי לעשות בעצמו — סגירת ניסיון וכתיבת ציון,
 * ורישום קריאות למודל. לכל השאר יש את createServerSupabase.
 */
export function createAdminSupabase() {
  return createClient(supabaseUrl(), supabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
