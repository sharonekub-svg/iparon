import { NextResponse } from 'next/server';

import { parseCallback, verifyCallbackSignature } from '@/lib/payments/payplus';
import { packBySlug } from '@/lib/pricing';
import { createAdminSupabase } from '@/lib/supabase/admin';

/**
 * ה-callback של ספק התשלומים. **זו הנקודה היחידה שמשדרגת משתמש.**
 *
 * לא מסתמכים על חזרת המשתמש לדף ההצלחה: דפדפן נסגר באמצע, ואת הכתובת
 * הזאת אפשר גם פשוט להקליד. מה שקובע הוא הודעת שרת-לשרת חתומה.
 */
export async function POST(request: Request) {
  // הגוף הגולמי, לפני JSON.parse: החתימה מחושבת על הבתים שנשלחו,
  // וסריאליזציה מחדש הייתה משנה אותם ושוברת את האימות.
  const rawBody = await request.text();

  if (!verifyCallbackSignature(rawBody, request.headers.get('hash'))) {
    console.error('[payments:signature] callback עם חתימה לא תקינה');
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const payload = parseCallback(raw);

  const pack = payload.packSlug ? packBySlug(payload.packSlug) : null;

  if (!payload.transactionUid || !payload.userId || !pack) {
    console.error('[payments:payload] callback בלי מזהה עסקה, משתמש או חבילה');
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // סכום קטן ממחיר החבילה לא מזכה. הבדיקה חוזרת גם במסד — שם המחיר
  // הוא מקור האמת — וכאן היא רק כדי שזה יירשם בלוג עם ההקשר.
  const approved = payload.approved && payload.amountAgorot >= pack.priceAgorot;
  if (payload.approved && !approved) {
    console.error('[payments:amount]', payload.transactionUid, payload.amountAgorot);
  }

  const supabase = createAdminSupabase();

  // רישום וזיכוי יחד. כפילות (אותו callback פעמיים) נופלת על ה-unique
  // ומגלגלת את שניהם לאחור, ולכן אין זיכוי כפול.
  const { error } = await supabase.rpc('record_payment', {
    p_user_id: payload.userId,
    p_provider: 'payplus',
    p_txn_uid: payload.transactionUid,
    p_approved: approved,
    p_amount_agorot: payload.amountAgorot,
    p_pack: pack.slug,
    p_raw: raw,
  });

  if (error) {
    // 23505 = כפילות. כבר טיפלנו בעסקה הזאת, ומחזירים 200 כדי שהספק
    // יפסיק לנסות.
    if (error.code === '23505') return NextResponse.json({ ok: true });

    // כאן הכסף כבר נגבה והזיכוי לא קרה. 500 מבקש מהספק לנסות שוב,
    // והניסיון החוזר נקי כי הטרנזקציה התגלגלה לאחור.
    console.error('[payments:record]', payload.userId, error.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
