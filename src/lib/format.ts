const MONTHS = [
  'ינואר',
  'פברואר',
  'מרץ',
  'אפריל',
  'מאי',
  'יוני',
  'יולי',
  'אוגוסט',
  'ספטמבר',
  'אוקטובר',
  'נובמבר',
  'דצמבר',
];

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * "היום" / "אתמול" / "12 ביולי" / "12 ביולי 2025".
 * ידני ולא דרך Intl — הרינדור זהה ב־iOS וב־Android.
 */
export function formatHebrewDate(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const dayDelta = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (dayDelta === 0) {
    return 'היום';
  }
  if (dayDelta === 1) {
    return 'אתמול';
  }

  const day = `${date.getDate()} ב${MONTHS[date.getMonth()]}`;
  return date.getFullYear() === now.getFullYear() ? day : `${day} ${date.getFullYear()}`;
}

/**
 * ריבוי בעברית לספירות קטנות: "כרטיסייה אחת" מול "18 כרטיסיות".
 */
export function countLabel(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : `${count} ${plural}`;
}

/** מחבר חלקי מטא־דאטה בנקודה מפרידה, ומדלג על חלקים ריקים. */
export function joinMeta(parts: (string | null | undefined | false)[]): string {
  return parts.filter((part): part is string => Boolean(part)).join(' · ');
}
