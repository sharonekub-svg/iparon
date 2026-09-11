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

describe('חבילות', () => {
  it('מחיר ליחידה יורד ככל שהחבילה גדולה', async () => {
    const { packs } = await import('@/lib/pricing');
    const perUpload = packs.map((pack) => pack.priceAgorot / pack.uploads);

    expect(perUpload).toEqual([...perUpload].sort((a, b) => b - a));
  });

  it('כל חבילה מכסה לפחות פי שניים את עלות המודל', async () => {
    const { packs } = await import('@/lib/pricing');
    // ~$0.47 להעלאה ב-Opus 5, בשער 3.7 ש"ח לדולר. ראה docs/PLAN.md סעיף 8.
    const costAgorotPerUpload = 175;

    for (const pack of packs) {
      expect(pack.priceAgorot / pack.uploads).toBeGreaterThan(costAgorotPerUpload * 2);
    }
  });

  it('יש בדיוק חבילה אחת מומלצת', async () => {
    const { packs } = await import('@/lib/pricing');
    expect(packs.filter((pack) => pack.featured)).toHaveLength(1);
  });
});
