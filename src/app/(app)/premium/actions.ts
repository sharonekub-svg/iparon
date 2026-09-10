'use server';

import { redirect } from 'next/navigation';

import { createCheckoutUrl, payplusConfigured } from '@/lib/payments/payplus';
import { siteUrl } from '@/lib/env';
import { createServerSupabase } from '@/lib/supabase/server';

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
