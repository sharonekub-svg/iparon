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
  it('מחיר לעמוד יורד ככל שהחבילה גדולה', async () => {
    const { packs } = await import('@/lib/pricing');
    const perPage = packs.map((pack) => pack.priceAgorot / pack.pages);

    expect(perPage).toEqual([...perPage].sort((a, b) => b - a));
  });

  it('כל חבילה מכסה לפחות פי שניים את עלות המודל', async () => {
    const { packs } = await import('@/lib/pricing');
    // ~₪2.30 למנה של 20 עמודים ב-Opus 5, כלומר ~11.5 אגורות לעמוד.
    // ראה docs/PLAN.md סעיף 8.2.
    const costAgorotPerPage = 11.5;

    for (const pack of packs) {
      expect(pack.priceAgorot / pack.pages).toBeGreaterThan(costAgorotPerPage * 2);
    }
  });

  it('יש בדיוק חבילה אחת מומלצת', async () => {
    const { packs } = await import('@/lib/pricing');
    expect(packs.filter((pack) => pack.featured)).toHaveLength(1);
  });
});
