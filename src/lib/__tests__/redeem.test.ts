import { describe, expect, it } from 'vitest';

import { looksLikeRedeemCode, normalizeRedeemCode } from '@/lib/validation/redeem';

/**
 * הקוד מוכתב בוואטסאפ ומוקלד בטלפון. אם "lamdai-ab12 cd34" ייחשב
 * שגוי, התלמיד ששילם יחשוב שרימו אותו.
 */
describe('קוד הפעלה', () => {
  it('מנקה רווחים ומעלה לאותיות גדולות', () => {
    expect(normalizeRedeemCode(' lamdai-ab12-cd34 ')).toBe('LAMDAI-AB12-CD34');
    expect(normalizeRedeemCode('LAMDAI AB12 CD34')).toBe('LAMDAIAB12CD34');
  });

  it('מקבל קוד תקין', () => {
    expect(looksLikeRedeemCode('LAMDAI-AB12-CD34')).toBe(true);
    expect(looksLikeRedeemCode('lamdai-ab12-cd34')).toBe(true);
  });

  it('דוחה קוד קצר, ריק, או עם תווים זרים', () => {
    expect(looksLikeRedeemCode('')).toBe(false);
    expect(looksLikeRedeemCode('ABC')).toBe(false);
    expect(looksLikeRedeemCode('LAMDAI-קוד-1234')).toBe(false);
    expect(looksLikeRedeemCode("LAMDAI'; drop table--")).toBe(false);
  });
});
