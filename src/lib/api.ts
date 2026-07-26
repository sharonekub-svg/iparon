import { env } from '@/src/config/env';
import { getDeviceId } from '@/src/lib/device';
import type { MaterialSource, MaterialSummary } from '@/src/types/material';
import { parseStudySet, type StudySet } from '@/src/types/study';

/**
 * הלקוח של ה-Edge Functions.
 *
 * כלל ברזל 2: האפליקציה שולחת את הקובץ לפונקציה, והפונקציה מדברת עם המודל.
 * הטבלאות חסומות ב-RLS מול מפתח ה-anon, ולכן גם קריאת הרשימה עוברת כאן.
 */

export class ApiError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

export function isConfigured(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}

function functionsUrl(path: string): string {
  return `${env.supabaseUrl.replace(/\/$/, '')}/functions/v1/${path}`;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  if (!isConfigured()) {
    throw new ApiError('not_configured', 'החיבור לשרת לא מוגדר.');
  }

  let response: Response;
  try {
    response = await fetch(functionsUrl(path), {
      ...init,
      headers: {
        ...init?.headers,
        apikey: env.supabaseAnonKey,
        Authorization: `Bearer ${env.supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
    });
  } catch {
    throw new ApiError('network', 'אין חיבור לשרת. בדוק את האינטרנט ונסה שוב.');
  }

  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  if (!response.ok) {
    const error =
      typeof body === 'object' && body !== null && 'error' in body
        ? (body as { error?: { code?: string; message?: string } }).error
        : undefined;

    throw new ApiError(error?.code ?? 'unknown', error?.message ?? 'משהו נשבר בדרך לשרת.');
  }

  return body as T;
}

export async function fetchMaterials(): Promise<MaterialSummary[]> {
  const deviceId = await getDeviceId();
  const body = await call<{ materials: MaterialSummary[] }>(
    `materials?deviceId=${encodeURIComponent(deviceId)}`,
  );
  return body.materials;
}

export type MaterialDetail = MaterialSummary & {
  studySet: StudySet | null;
  error: string | null;
};

export async function fetchMaterial(id: string): Promise<MaterialDetail> {
  const deviceId = await getDeviceId();
  const body = await call<{ material: MaterialDetail }>(
    `materials?deviceId=${encodeURIComponent(deviceId)}&id=${encodeURIComponent(id)}`,
  );

  // התוצאה מאומתת גם כאן, ולא רק בשרת: המבנה הוא החוזה, ומסכי הכרטיסיות
  // והקוויז נשענים עליו.
  return {
    ...body.material,
    studySet: body.material.studySet ? parseStudySet(body.material.studySet) : null,
  };
}

export type AnalyzeInput = {
  title: string;
  source: MaterialSource;
  mediaType: string;
  fileBase64: string;
  pageCount?: number;
};

/** מחזיר את החומר במצב "בעיבוד". העיבוד עצמו נמשך בשרת. */
export async function requestAnalysis(input: AnalyzeInput): Promise<MaterialSummary> {
  const deviceId = await getDeviceId();
  const body = await call<{ material: MaterialSummary }>('analyze', {
    method: 'POST',
    body: JSON.stringify({ deviceId, ...input }),
  });
  return body.material;
}
