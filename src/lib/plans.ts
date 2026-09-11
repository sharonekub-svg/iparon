import { createServerSupabase } from '@/lib/supabase/server';

/**
 * מה מותר למשתמש המחובר.
 *
 * הקריאה כאן היא לתצוגה בלבד — כדי לדעת מה להציג ומה לנעול. האכיפה
 * עצמה במסד: טריגר על study_sets בודק וגורע יחידה באותה טרנזקציה של
 * היצירה. גם מי שיעקוף את הממשק לגמרי ייחסם שם.
 */
export type Entitlements = {
  /** עמודים שנשארו ביתרה */
  credits: number;
  setsUsed: number;
  /** האם ההעלאה החינמית כבר נוצלה */
  freeUsed: boolean;
};

export async function getEntitlements(): Promise<Entitlements> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('my_entitlements').single();

  if (error || !data) {
    console.error('[plans:entitlements]', error?.message);
    // ברירת מחדל מחמירה: בספק, בלי יתרה.
    return { credits: 0, setsUsed: 0, freeUsed: true };
  }

  const row = data as { credits: number; sets_used: number; free_used: boolean };

  return {
    credits: row.credits,
    setsUsed: row.sets_used,
    freeUsed: row.free_used,
  };
}

export async function getUploadAllowance(): Promise<{
  allowed: boolean;
  reason: string | null;
}> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('my_upload_allowance').single();

  if (error || !data) {
    console.error('[plans:allowance]', error?.message);
    return { allowed: false, reason: 'לא הצלחנו לבדוק את היתרה. נסה שוב.' };
  }

  const row = data as { allowed: boolean; reason: string | null };
  return { allowed: row.allowed, reason: row.reason };
}
