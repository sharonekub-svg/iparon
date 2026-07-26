import { demoMaterials } from './demoMaterials';
import { env } from '@/src/config/env';
import { fetchMaterial, fetchMaterials, isConfigured, type MaterialDetail } from '@/src/lib/api';
import type { MaterialSummary } from '@/src/types/material';

/**
 * שכבת הנתונים של רשימת החומרים.
 *
 * כשיש פרויקט Supabase מוגדר, הכול עובר דרך ה-Edge Functions.
 * בלי הגדרה — למשל בעבודה על העיצוב — נטענים חומרי הדגמה מקומיים,
 * כדי שהמסכים יעבדו בלי שרת.
 */

function newestFirst(a: MaterialSummary, b: MaterialSummary): number {
  return Date.parse(b.createdAt) - Date.parse(a.createdAt);
}

function localMaterials(): MaterialSummary[] {
  return env.seedDemoData ? [...demoMaterials].sort(newestFirst) : [];
}

export async function listMaterials(): Promise<MaterialSummary[]> {
  if (!isConfigured()) {
    return localMaterials();
  }

  const materials = await fetchMaterials();
  return [...materials].sort(newestFirst);
}

export async function getMaterial(id: string): Promise<MaterialDetail | null> {
  if (!isConfigured()) {
    const local = localMaterials().find((material) => material.id === id);
    return local ? { ...local, studySet: null, error: null } : null;
  }

  return fetchMaterial(id);
}
