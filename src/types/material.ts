import type { StudySet } from './study';

export type MaterialStatus = 'processing' | 'ready' | 'failed';

export type MaterialSource = 'pdf' | 'camera';

/** מה שמסך הבית צריך: שורה ברשימה, בלי התוכן המלא. */
export type MaterialSummary = {
  id: string;
  title: string;
  /** ISO 8601 */
  createdAt: string;
  status: MaterialStatus;
  source: MaterialSource;
  pageCount: number;
  flashcardCount: number;
  quizCount: number;
};

/** החומר המלא, כולל התוצאה שחזרה מהפונקציה. */
export type Material = MaterialSummary & {
  studySet: StudySet | null;
};

export const statusLabels: Record<MaterialStatus, string> = {
  processing: 'בעיבוד',
  ready: 'מוכן',
  failed: 'נכשל',
};
