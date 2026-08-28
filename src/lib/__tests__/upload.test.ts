import { describe, expect, it } from 'vitest';

import { describeRejection, isAcceptedType, uploadLimits } from '@/lib/validation/upload';

function file(name: string, type: string, mb: number) {
  return { name, type, size: Math.round(mb * 1024 * 1024) };
}

describe('describeRejection', () => {
  it('מקבל תמונות בודדות ומרובות', () => {
    expect(describeRejection([file('a.jpg', 'image/jpeg', 1)])).toBeNull();
    expect(
      describeRejection([file('a.jpg', 'image/jpeg', 1), file('b.png', 'image/png', 2)]),
    ).toBeNull();
  });

  it('מקבל PDF בודד', () => {
    expect(describeRejection([file('x.pdf', 'application/pdf', 5)])).toBeNull();
  });

  it('דוחה בחירה ריקה', () => {
    expect(describeRejection([])).toBe('לא נבחר קובץ');
  });

  it('דוחה שני קובצי PDF', () => {
    const two = [
      file('a.pdf', 'application/pdf', 1),
      file('b.pdf', 'application/pdf', 1),
    ];
    expect(describeRejection(two)).toContain('PDF אחד');
  });

  it('דוחה ערבוב של PDF ותמונה', () => {
    const mixed = [file('a.pdf', 'application/pdf', 1), file('b.jpg', 'image/jpeg', 1)];
    expect(describeRejection(mixed)).toContain('לא ערבוב');
  });

  it('דוחה סוג שאינו נתמך', () => {
    expect(describeRejection([file('a.docx', 'application/msword', 1)])).toContain(
      'PDF, JPG או PNG',
    );
  });

  it('דוחה קובץ בודד מעל 15MB', () => {
    expect(describeRejection([file('big.jpg', 'image/jpeg', 16)])).toContain(
      'גדול מ-15MB',
    );
  });

  it('דוחה סכום שעובר את התקרה גם כשכל קובץ חוקי', () => {
    const many = Array.from({ length: 3 }, (_, i) => file(`p${i}.jpg`, 'image/jpeg', 10));
    expect(describeRejection(many)).toContain('גדול מדי');
  });

  it('דוחה יותר מדי עמודים', () => {
    const many = Array.from({ length: uploadLimits.maxFiles + 1 }, (_, i) =>
      file(`p${i}.jpg`, 'image/jpeg', 0.1),
    );
    expect(describeRejection(many)).toContain(`${uploadLimits.maxFiles}`);
  });
});

describe('isAcceptedType', () => {
  it('מקבל בדיוק שלושה סוגים', () => {
    expect(isAcceptedType('application/pdf')).toBe(true);
    expect(isAcceptedType('image/jpeg')).toBe(true);
    expect(isAcceptedType('image/png')).toBe(true);
  });

  it('דוחה כל השאר', () => {
    expect(isAcceptedType('image/gif')).toBe(false);
    expect(isAcceptedType('image/svg+xml')).toBe(false);
    expect(isAcceptedType('text/html')).toBe(false);
    expect(isAcceptedType('')).toBe(false);
  });
});
