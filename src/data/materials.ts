import { demoMaterials } from './demoMaterials';
import { env } from '@/src/config/env';
import type { MaterialSummary } from '@/src/types/material';

/**
 * שכבת הנתונים של רשימת החומרים.
 *
 * בשלב הזה המימוש מקומי ובזיכרון בלבד. בשלב 4, כשה־Edge Function
 * וטבלאות ה־Postgres קיימות, גוף הפונקציות מוחלף בשאילתות Supabase —
 * החתימות נשארות זהות, ולכן המסכים לא משתנים.
 */

const store: MaterialSummary[] = env.seedDemoData ? [...demoMaterials] : [];

function newestFirst(a: MaterialSummary, b: MaterialSummary): number {
  return Date.parse(b.createdAt) - Date.parse(a.createdAt);
}

export async function listMaterials(): Promise<MaterialSummary[]> {
  return [...store].sort(newestFirst);
}
