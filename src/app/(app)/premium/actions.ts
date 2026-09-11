'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createCheckoutUrl, payplusConfigured } from '@/lib/payments/payplus';
import { siteUrl } from '@/lib/env';
import { createServerSupabase } from '@/lib/supabase/server';
import { looksLikeRedeemCode, normalizeRedeemCode } from '@/lib/validation/redeem';

/**
 * פותח דף תשלום ומעביר אליו.
 *
 * הסכום לא מגיע מהלקוח אלא מ-src/lib/pricing.ts. טופס שמעביר מחיר
 * מהדפדפן הוא טופס שאפשר לשלם בו שקל.
 */
export async function startCheckout(): Promise<{ error: string } | never> {
  if (!payplusConfigured()) {
    return { error: 'התשלום עדיין לא פתוח.' };
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { error: 'צריך להתחבר כדי לשדרג.' };
  }

  const result = await createCheckoutUrl({
    userId: user.id,
    email: user.email,
    siteUrl: siteUrl(),
  });

  if (!result.ok) {
    return { error: result.error };
  }

  // redirect זורק, ולכן הוא מחוץ ל-try של הקריאה לספק.
  redirect(result.url);
}

/**
 * הפעלת קוד שנמסר ידנית אחרי תשלום מחוץ למערכת.
 *
 * כל ההיגיון במסד: הפונקציה שם נועלת את השורה, מוודאת שהקוד לא מומש
 * ולא פג, ומשדרגת — הכול בטרנזקציה אחת. שתי לחיצות במקביל לא פותחות
 * חודשיים.
 */
export async function redeemCode(
  formData: FormData,
): Promise<{ error?: string; notice?: string }> {
  const raw = String(formData.get('code') ?? '');

  if (!looksLikeRedeemCode(raw)) {
    return { error: 'הקוד לא נראה תקין. בדוק שהוקלד במלואו.' };
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .rpc('redeem_code', { p_code: normalizeRedeemCode(raw) })
    .single();

  if (error || !data) {
    console.error('[premium:redeem]', error?.message);
    return { error: 'לא הצלחנו לבדוק את הקוד. נסה שוב.' };
  }

  const row = data as { ok: boolean; message: string };

  if (!row.ok) return { error: row.message };

  // המסלול השתנה, והדפים מציגים מכסה. בלי זה המשתמש היה רואה מסך ישן.
  revalidatePath('/premium');
  revalidatePath('/dashboard');
  revalidatePath('/upload');

  return { notice: row.message };
}
