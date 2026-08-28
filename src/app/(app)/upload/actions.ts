'use server';

import { createServerSupabase } from '@/lib/supabase/server';
import {
  extensionFor,
  isAcceptedType,
  uploadLimits,
  type AcceptedType,
} from '@/lib/validation/upload';

export type PreparedUpload = {
  studySetId: string;
  targets: { path: string; token: string; mimeType: string }[];
};

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

type FileMeta = { name: string; size: number; type: string };

/**
 * שלב 1 של ההעלאה: יוצר את החומר ומחזיר כתובות העלאה חתומות.
 *
 * הקובץ עצמו לא עובר דרך השרת. Vercel חוסמת גוף בקשה מעל 4.5MB, וסריקה
 * של כמה עמודים עוברת את זה בקלות — לכן הדפדפן מעלה ישירות ל-Storage
 * מול כתובת חתומה קצרת-מועד, ואנחנו רק מנפיקים אותה.
 */
export async function prepareUpload(files: FileMeta[]): Promise<Result<PreparedUpload>> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: 'לא מחובר' };

  if (files.length === 0 || files.length > uploadLimits.maxFiles) {
    return { ok: false, error: 'מספר הקבצים לא תקין' };
  }

  let total = 0;
  for (const file of files) {
    if (!isAcceptedType(file.type)) {
      return { ok: false, error: 'אפשר להעלות PDF, JPG או PNG בלבד' };
    }
    if (file.size <= 0 || file.size > uploadLimits.maxFileBytes) {
      return { ok: false, error: 'אחד הקבצים גדול מדי' };
    }
    total += file.size;
  }
  if (total > uploadLimits.maxTotalBytes) {
    return { ok: false, error: 'סך הקבצים גדול מדי. נסה להעלות פחות עמודים' };
  }

  // ניקוי שורות יתומות של המשתמש עצמו: אם הדפדפן נפל בין יצירת החומר
  // לבין ההעלאה, נשארה שורה queued בלי קבצים שתופסת לו מכסה לנצח.
  // נעשה כאן ולא בעבודת רקע — זה הרגע היחיד שבו זה מפריע למישהו.
  const staleBefore = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: stale } = await supabase
    .from('study_sets')
    .select('id, documents(count)')
    .eq('status', 'queued')
    .lt('created_at', staleBefore);

  const orphans = (stale ?? [])
    .filter((row) => (row.documents?.[0]?.count ?? 0) === 0)
    .map((row) => row.id as string);

  if (orphans.length > 0) {
    await supabase.from('study_sets').delete().in('id', orphans);
  }

  // כותרת זמנית. המודל מחזיר כותרת אמיתית, והיא נכתבת בסוף העיבוד.
  const { data: set, error: setError } = await supabase
    .from('study_sets')
    .insert({
      user_id: user.id,
      title: 'חומר חדש',
      status: 'queued',
      stage: 'queued',
      page_count: files.length,
    })
    .select('id')
    .single();

  if (setError || !set) {
    console.error('[upload:create]', setError?.message);
    return { ok: false, error: 'לא הצלחנו לפתוח את החומר. נסה שוב.' };
  }

  const targets: PreparedUpload['targets'] = [];

  for (const [i, file] of files.entries()) {
    // המקטע הראשון בנתיב חייב להיות מזהה המשתמש — כך אוכפת מדיניות
    // ה-Storage שאי אפשר לכתוב לתיקייה של מישהו אחר.
    const path = `${user.id}/${set.id}/${i}.${extensionFor(file.type as AcceptedType)}`;

    const { data, error } = await supabase.storage
      .from('materials')
      .createSignedUploadUrl(path);

    if (error || !data) {
      console.error('[upload:sign]', error?.message);
      return { ok: false, error: 'לא הצלחנו להכין את ההעלאה. נסה שוב.' };
    }

    targets.push({ path: data.path, token: data.token, mimeType: file.type });
  }

  return { ok: true, data: { studySetId: set.id as string, targets } };
}

/**
 * שלב 2: הקבצים כבר ב-Storage. רושמים אותם ומעירים את העובד.
 */
export async function startProcessing(
  studySetId: string,
  docs: { path: string; size: number; mimeType: string }[],
): Promise<Result<null>> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: 'לא מחובר' };

  const { error: docError } = await supabase.from('documents').insert(
    docs.map((doc) => ({
      study_set_id: studySetId,
      user_id: user.id,
      storage_path: doc.path,
      mime_type: doc.mimeType,
      size_bytes: doc.size,
    })),
  );

  if (docError) {
    console.error('[upload:documents]', docError.message);
    return { ok: false, error: 'שמירת הקבצים נכשלה. נסה שוב.' };
  }

  // ה-session של המשתמש מועבר לפונקציה; הבעלות נבדקת שם מול הרשומה.
  const { error: invokeError } = await supabase.functions.invoke('process-material', {
    body: { studySetId },
  });

  if (invokeError) {
    console.error('[upload:invoke]', invokeError.message);
    return { ok: false, error: 'העיבוד לא התחיל. נסה שוב.' };
  }

  return { ok: true, data: null };
}

/** מסך העיבוד שואל את זה כל כמה שניות. */
export async function getProgress(
  studySetId: string,
): Promise<{ status: string; stage: string; error: string | null } | null> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('study_sets')
    .select('status, stage, error')
    .eq('id', studySetId)
    .maybeSingle();

  return data as { status: string; stage: string; error: string | null } | null;
}
