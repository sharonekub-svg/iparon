import type { MaterialSummary } from '@/src/types/material';

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

/**
 * חומרי הדגמה למסך הבית בזמן פיתוח בלבד.
 * נטענים רק כש־EXPO_PUBLIC_SEED_DEMO=1, ולא נשלחים לשום מקום.
 */
export const demoMaterials: MaterialSummary[] = [
  {
    id: 'demo-1',
    title: 'ביולוגיה — נשימה תאית',
    createdAt: daysAgo(0),
    status: 'ready',
    source: 'pdf',
    pageCount: 4,
    flashcardCount: 18,
    quizCount: 10,
  },
  {
    id: 'demo-2',
    title: 'היסטוריה — עליית הנאצים לשלטון',
    createdAt: daysAgo(1),
    status: 'processing',
    source: 'camera',
    pageCount: 2,
    flashcardCount: 0,
    quizCount: 0,
  },
  {
    id: 'demo-3',
    title: 'מתמטיקה 5 יח״ל — נגזרות',
    createdAt: daysAgo(9),
    status: 'ready',
    source: 'pdf',
    pageCount: 7,
    flashcardCount: 24,
    quizCount: 12,
  },
];
