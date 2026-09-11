import { createHmac } from 'node:crypto';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const SECRET = 'test-secret';

/**
 * הבדיקה החשובה כאן היא אימות החתימה: בלעדיה כל אחד שיודע את כתובת
 * ה-callback יכול לשלוח "שילמתי" ולקבל מנוי בחינם.
 */
describe('callback של ספק התשלומים', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('PAYPLUS_API_KEY', 'key');
    vi.stubEnv('PAYPLUS_SECRET_KEY', SECRET);
    vi.stubEnv('PAYPLUS_PAYMENT_PAGE_UID', 'page-uid');
  });

  async function load() {
    return import('@/lib/payments/payplus');
  }

  function sign(body: string, secret = SECRET): string {
    return createHmac('sha256', secret).update(body).digest('base64');
  }

  it('מקבל חתימה תקינה', async () => {
    const { verifyCallbackSignature } = await load();
    const body = '{"transaction":{"uid":"abc"}}';

    expect(verifyCallbackSignature(body, sign(body))).toBe(true);
  });

  it('דוחה חתימה של מפתח אחר, גוף שהשתנה, וחתימה חסרה', async () => {
    const { verifyCallbackSignature } = await load();
    const body = '{"transaction":{"uid":"abc"}}';

    expect(verifyCallbackSignature(body, sign(body, 'wrong-secret'))).toBe(false);
    expect(verifyCallbackSignature('{"transaction":{"uid":"xyz"}}', sign(body))).toBe(
      false,
    );
    expect(verifyCallbackSignature(body, null)).toBe(false);
    expect(verifyCallbackSignature(body, '')).toBe(false);
  });

  it('לא מאשר כלום כשאין מפתחות בשרת', async () => {
    vi.stubEnv('PAYPLUS_SECRET_KEY', '');
    const { verifyCallbackSignature, payplusConfigured } = await load();
    const body = '{}';

    expect(payplusConfigured()).toBe(false);
    expect(verifyCallbackSignature(body, sign(body))).toBe(false);
  });

  it('קורא עסקה מאושרת: מזהה, משתמש, חבילה וסכום באגורות', async () => {
    const { parseCallback } = await load();

    const parsed = parseCallback({
      transaction: {
        uid: 'txn-1',
        status_code: '000',
        more_info: 'user-1|term',
        amount: 69,
      },
    });

    expect(parsed).toEqual({
      transactionUid: 'txn-1',
      userId: 'user-1',
      packSlug: 'term',
      approved: true,
      amountAgorot: 6900,
    });
  });

  it('בלי חבילה ב-more_info אין מה לזכות', async () => {
    const { parseCallback } = await load();

    const parsed = parseCallback({
      transaction: { uid: 'txn-3', status_code: '000', more_info: 'user-1', amount: 69 },
    });

    expect(parsed.packSlug).toBeNull();
  });

  it('לא מסמן כמאושרת עסקה עם קוד אחר', async () => {
    const { parseCallback } = await load();

    const parsed = parseCallback({
      transaction: { uid: 'txn-2', status_code: '001', more_info: 'user-1', amount: 39 },
    });

    expect(parsed.approved).toBe(false);
  });

  it('לא נופל על גוף ריק או חלקי', async () => {
    const { parseCallback } = await load();

    expect(parseCallback({})).toEqual({
      transactionUid: null,
      userId: null,
      packSlug: null,
      approved: false,
      amountAgorot: 0,
    });
    expect(parseCallback(null).approved).toBe(false);
  });
});
