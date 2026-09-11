import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';

import type { Pack } from '@/lib/pricing';

/**
 * מתאם ל-PayPlus.
 *
 * כל מה שספציפי לספק יושב בקובץ הזה בלבד: אם מחליפים לקארדקום, מחליפים
 * קובץ אחד ולא נוגעים במסכים, ב-Route Handler או בטבלת התשלומים.
 *
 * ⚠️ הקוד הזה טרם נבדק מול חשבון PayPlus אמיתי — אין עדיין מפתחות.
 * לפני שמפעילים בייצור צריך לאמת מול התיעוד של PayPlus שלושה דברים:
 *   1. שם השדה ופורמט הכותרת של האימות (Authorization עם api_key/secret_key).
 *   2. שמות שדות הכתובות החוזרות (refURL_success / refURL_failure / refURL_callback).
 *   3. איך נחתם ה-callback ובאיזו כותרת מגיע החתימה (כאן: HMAC-SHA256 של
 *      גוף הבקשה הגולמי עם secret_key, ב-base64, בכותרת hash).
 * עד שזה נבדק — כפתור התשלום לא מוצג כלל, כי המשתנים לא מוגדרים.
 */

type PayPlusConfig = {
  baseUrl: string;
  apiKey: string;
  secretKey: string;
  paymentPageUid: string;
};

function readConfig(): PayPlusConfig | null {
  const apiKey = process.env.PAYPLUS_API_KEY;
  const secretKey = process.env.PAYPLUS_SECRET_KEY;
  const paymentPageUid = process.env.PAYPLUS_PAYMENT_PAGE_UID;

  if (!apiKey?.trim() || !secretKey?.trim() || !paymentPageUid?.trim()) return null;

  return {
    // ברירת המחדל היא הסביבה הבודקת. מעבר לייצור הוא שינוי משתנה סביבה,
    // ולא שינוי קוד — כדי שלא ייגבה כסף אמיתי בטעות בזמן פיתוח.
    baseUrl: (process.env.PAYPLUS_BASE_URL ?? 'https://restapidev.payplus.co.il').replace(
      /\/$/,
      '',
    ),
    apiKey,
    secretKey,
    paymentPageUid,
  };
}

export function payplusConfigured(): boolean {
  return readConfig() !== null;
}

export type CheckoutRequest = {
  userId: string;
  email: string;
  siteUrl: string;
  pack: Pack;
};

/**
 * מנפיק כתובת לדף תשלום מאורח אצל PayPlus.
 *
 * הכסף לא עובר דרכנו ופרטי הכרטיס לא נוגעים בשרת שלנו — זה גם התקן
 * וגם פחות אחריות עלינו.
 */
export async function createCheckoutUrl(
  req: CheckoutRequest,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const config = readConfig();
  if (!config) return { ok: false, error: 'התשלום לא מוגדר בשרת' };

  const body = {
    payment_page_uid: config.paymentPageUid,
    charge_method: 1,
    amount: req.pack.priceAgorot / 100,
    currency_code: 'ILS',
    sendEmailApproval: true,
    sendEmailFailure: false,
    refURL_success: `${req.siteUrl}/premium?status=success`,
    refURL_failure: `${req.siteUrl}/premium?status=failure`,
    refURL_callback: `${req.siteUrl}/api/payments/payplus/callback`,
    customer: { email: req.email },
    // חוזר אלינו ב-callback ומאפשר לדעת את מי לזכות ובכמה. לא סוד ולא
    // מספיק כשלעצמו: הזיכוי קורה רק אחרי אימות החתימה של הספק, והכמות
    // נקראת מטבלת החבילות ולא מכאן.
    more_info: `${req.userId}|${req.pack.slug}`,
    items: [
      {
        name: `חבילה: ${req.pack.title} — ${req.pack.pages} עמודים`,
        quantity: 1,
        price: req.pack.priceAgorot / 100,
      },
    ],
  };

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/api/v1.0/PaymentPages/generateLink`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: JSON.stringify({
          api_key: config.apiKey,
          secret_key: config.secretKey,
        }),
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.error('[payplus:network]', error);
    return { ok: false, error: 'לא הצלחנו להגיע לספק התשלומים. נסה שוב.' };
  }

  if (!response.ok) {
    console.error('[payplus:http]', response.status, await response.text());
    return { ok: false, error: 'פתיחת דף התשלום נכשלה. נסה שוב.' };
  }

  const json = (await response.json()) as {
    results?: { status?: string; description?: string };
    data?: { payment_page_link?: string };
  };

  const url = json.data?.payment_page_link;
  if (!url) {
    console.error('[payplus:link]', json.results?.description ?? 'תשובה בלי קישור');
    return { ok: false, error: 'פתיחת דף התשלום נכשלה. נסה שוב.' };
  }

  return { ok: true, url };
}

/**
 * אימות החתימה של ה-callback.
 *
 * בלי זה כל אחד שיודע את הכתובת יכול לשלוח "שילמתי" ולקבל מנוי.
 * ההשוואה ב-timingSafeEqual ולא ב-`===`.
 */
export function verifyCallbackSignature(
  rawBody: string,
  signature: string | null,
): boolean {
  const config = readConfig();
  if (!config || !signature) return false;

  const expected = createHmac('sha256', config.secretKey)
    .update(rawBody)
    .digest('base64');

  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}

export type CallbackPayload = {
  transactionUid: string | null;
  userId: string | null;
  packSlug: string | null;
  approved: boolean;
  amountAgorot: number;
};

/** קריאה של גוף ה-callback לצורה שהקוד שלנו מכיר. */
export function parseCallback(raw: unknown): CallbackPayload {
  const body = (raw ?? {}) as Record<string, unknown>;
  const data = (body.transaction ?? body.data ?? body) as Record<string, unknown>;

  const statusCode = String(data.status_code ?? body.status_code ?? '');
  const status = String(data.status ?? body.status ?? '').toLowerCase();
  const amount = Number(data.amount ?? body.amount ?? 0);

  const moreInfo =
    typeof data.more_info === 'string'
      ? data.more_info
      : typeof body.more_info === 'string'
        ? body.more_info
        : '';

  // "<userId>|<pack>" — נשלח על ידינו ביצירת דף התשלום.
  const [userId, packSlug] = moreInfo.split('|');

  return {
    transactionUid:
      typeof data.uid === 'string'
        ? data.uid
        : typeof body.transaction_uid === 'string'
          ? body.transaction_uid
          : null,
    userId: userId || null,
    packSlug: packSlug || null,
    // PayPlus מסמנת עסקה מאושרת ב-status_code '000'.
    approved: statusCode === '000' || status === 'approved',
    amountAgorot: Number.isFinite(amount) ? Math.round(amount * 100) : 0,
  };
}
