import { describe, expect, it } from 'vitest';

import { safeRedirectPath } from '@/lib/validation/auth';

/**
 * `next` מגיע מהכתובת, כלומר מכל מי ששולח קישור. פרמטר שלא נבדק הוא
 * open redirect: קישור שנראה כמו האתר שלנו ומעביר לאתר אחר. זו הבדיקה
 * הכי חשובה בקובץ הזה.
 */
describe('safeRedirectPath', () => {
  it('מחזיר נתיב פנימי כמו שהוא', () => {
    expect(safeRedirectPath('/sets/abc')).toBe('/sets/abc');
    expect(safeRedirectPath('/dashboard')).toBe('/dashboard');
    expect(safeRedirectPath('/upload?from=x')).toBe('/upload?from=x');
  });

  it('נופל לדשבורד כשאין ערך', () => {
    expect(safeRedirectPath(null)).toBe('/dashboard');
    expect(safeRedirectPath(undefined)).toBe('/dashboard');
    expect(safeRedirectPath('')).toBe('/dashboard');
  });

  it('חוסם כתובות חיצוניות', () => {
    // // הוא protocol-relative — הדפדפן הולך לדומיין חיצוני
    expect(safeRedirectPath('//evil.example.com')).toBe('/dashboard');
    expect(safeRedirectPath('//evil.example.com/path')).toBe('/dashboard');
    expect(safeRedirectPath('https://evil.example.com')).toBe('/dashboard');
    expect(safeRedirectPath('http://evil.example.com')).toBe('/dashboard');
  });

  it('חוסם סכמות שאינן http', () => {
    expect(safeRedirectPath('javascript:alert(1)')).toBe('/dashboard');
    expect(safeRedirectPath('data:text/html,x')).toBe('/dashboard');
  });

  it('חוסם נתיב יחסי בלי לוכסן מוביל', () => {
    expect(safeRedirectPath('dashboard')).toBe('/dashboard');
    expect(safeRedirectPath('evil.example.com')).toBe('/dashboard');
  });
});
