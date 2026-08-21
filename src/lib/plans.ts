import { createServerSupabase } from '@/lib/supabase/server';

/**
 * מה מותר למשתמש המחובר.
 *
 * הקריאה כאן היא לתצוגה בלבד — כדי לדעת מה להציג ומה לנעול. האכיפה
 * עצמה במסד: טריגר על study_sets חוסם העלאה מעל המכסה, ו-start_exam
 * דוחה מבחן למי שאינו במסלול המורחב. גם מי שיעקוף את הממשק לגמרי
 * ייחסם שם.
 */
export type Entitlements = {
  tier: 'free' | 'premium';
  examsEnabled: boolean;
  setsUsed: number;
  setsLimit: number | null;
  uploadsThisMonth: number;
  uploadsLimit: number | null;
};

export async function getEntitlements(): Promise<Entitlements> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('my_entitlements').single();

  if (error || !data) {
    console.error('[plans:entitlements]', error?.message);
    // ברירת מחדל מחמירה: בספק, מתייחסים אליו כחינמי ולא כמשודרג.
    return {
      tier: 'free',
      examsEnabled: false,
      setsUsed: 0,
      setsLimit: 1,
      uploadsThisMonth: 0,
      uploadsLimit: 1,
    };
  }

  const row = data as {
    tier: 'free' | 'premium';
    exams_enabled: boolean;
    sets_used: number;
    sets_limit: number | null;
    uploads_this_month: number;
    uploads_limit: number | null;
  };

  return {
    tier: row.tier,
    examsEnabled: row.exams_enabled,
    setsUsed: row.sets_used,
    setsLimit: row.sets_limit,
    uploadsThisMonth: row.uploads_this_month,
    uploadsLimit: row.uploads_limit,
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
    return { allowed: false, reason: 'לא הצלחנו לבדוק את המכסה. נסה שוב.' };
  }

  const row = data as { allowed: boolean; reason: string | null };
  return { allowed: row.allowed, reason: row.reason };
}
