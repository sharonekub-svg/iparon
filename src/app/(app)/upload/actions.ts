'use server';

import { PDFDocument } from 'pdf-lib';

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
    .select('id')
    .eq('status', 'queued')
    .lt('created_at', staleBefore);

  // כולל חומר שנרשמו לו קבצים אבל העיבוד מעולם לא התחיל — למשל
  // תלמיד שראה את המחיר, סגר את הדפדפן ולא אישר ולא ביטל.
  const orphans = (stale ?? []).map((row) => row.id as string);

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

/** חיוב מינימלי לחומר. חייב להסכים עם consume_pages במסד. */
const MIN_CHARGED_PAGES = 5;

/**
 * שלב 3: כמה עמודים החומר הזה יעלה, לפני שמעבדים אותו.
 *
 * זה קיים כדי שלא תהיה הפתעה: מצגת של 40 שקפים שבה חמש מילים בכל שקף
 * מחויבת ב-40 עמודים, כי כל שקף נשלח למודל כתמונה בין אם יש בו טקסט
 * ובין אם לא. עדיף שהתלמיד יראה את המספר ויחליט, מאשר שיגלה אותו
 * אחרי שהיתרה ירדה.
 *
 * הספירה כאן היא בשרת ולא בדפדפן: ספירת עמודים אמיתית דורשת פענוח של
 * עץ העמודים, וספרייה לזה בצד הלקוח היא מאות קילובייטים על רשת
 * סלולרית — בשביל מספר אחד.
 */
export async function estimatePages(
  studySetId: string,
): Promise<Result<{ pages: number; charged: number }>> {
  const supabase = await createServerSupabase();

  const { data: docs, error } = await supabase
    .from('documents')
    .select('storage_path, mime_type')
    .eq('study_set_id', studySetId)
    .is('deleted_at', null);

  if (error || !docs || docs.length === 0) {
    return { ok: false, error: 'לא הצלחנו לקרוא את הקבצים. נסה שוב.' };
  }

  let pages = 0;

  for (const doc of docs) {
    if (doc.mime_type !== 'application/pdf') {
      pages += 1; // תמונה = עמוד
      continue;
    }

    const { data: blob, error: downloadError } = await supabase.storage
      .from('materials')
      .download(doc.storage_path as string);

    if (downloadError || !blob) {
      return { ok: false, error: 'לא הצלחנו לקרוא את הקובץ. נסה שוב.' };
    }

    try {
      const pdf = await PDFDocument.load(await blob.arrayBuffer(), {
        ignoreEncryption: true,
      });
      pages += pdf.getPageCount();
    } catch {
      return { ok: false, error: 'לא הצלחנו לקרוא את ה-PDF. ייתכן שהוא פגום.' };
    }
  }

  return { ok: true, data: { pages, charged: Math.max(pages, MIN_CHARGED_PAGES) } };
}

/**
 * שלב 2: הקבצים כבר ב-Storage. רושמים אותם, עוד לפני העיבוד, כדי
 * שאפשר יהיה לספור עמודים ולהציג מחיר.
 */
export async function registerDocuments(
  studySetId: string,
  docs: { path: string; size: number; mimeType: string }[],
): Promise<Result<null>> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: 'לא מחובר' };

  // הנתיב מגיע מהלקוח, ולכן הוא לא נאמן. בלי הבדיקה הזאת אפשר לשלוח
  // נתיב של קובץ של משתמש אחר: העובד רץ ב-service role, שעוקף גם RLS
  // וגם את מדיניות ה-Storage, והיה מייצר ממנו חומר לימוד אצל התוקף.
  //
  // האכיפה האמיתית היא constraint על documents. זה כאן כדי שהמשתמש
  // יקבל הודעה מובנת ולא שגיאת מסד.
  const prefix = `${user.id}/`;
  if (docs.some((doc) => !doc.path.startsWith(prefix))) {
    console.error('[upload:path]', user.id, 'ניסיון לרשום נתיב מחוץ לתיקייה של המשתמש');
    return { ok: false, error: 'משהו השתבש בהעלאה. נסה שוב.' };
  }

  const { error } = await supabase.from('documents').insert(
    docs.map((doc) => ({
      study_set_id: studySetId,
      user_id: user.id,
      storage_path: doc.path,
      mime_type: doc.mimeType,
      size_bytes: doc.size,
    })),
  );

  if (error) {
    console.error('[upload:documents]', error.message);
    return { ok: false, error: 'שמירת הקבצים נכשלה. נסה שוב.' };
  }

  return { ok: true, data: null };
}

/**
 * התלמיד ראה את המחיר ואמר לא. מוחקים את החומר.
 *
 * בלי זה נשארת שורה במצב queued עם קבצים, שמופיעה בדשבורד כחומר
 * שלא נגמר. RLS מוודאת שאפשר למחוק רק חומר של המשתמש עצמו, והמחיקה
 * גוררת איתה את הקבצים.
 */
export async function cancelUpload(studySetId: string): Promise<Result<null>> {
  const supabase = await createServerSupabase();

  const { error } = await supabase
    .from('study_sets')
    .delete()
    .eq('id', studySetId)
    .eq('status', 'queued');

  if (error) {
    console.error('[upload:cancel]', error.message);
    return { ok: false, error: 'הביטול נכשל. נסה שוב.' };
  }

  return { ok: true, data: null };
}

/**
 * שלב 4: התלמיד ראה כמה זה עולה ואישר. מעירים את העובד.
 */
export async function startProcessing(studySetId: string): Promise<Result<null>> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: 'לא מחובר' };

  // ה-session של המשתמש מועבר לפונקציה; הבעלות נבדקת שם מול הרשומה.
  const { error } = await supabase.functions.invoke('process-material', {
    body: { studySetId },
  });

  if (error) {
    console.error('[upload:invoke]', error.message);
    return { ok: false, error: 'העיבוד לא התחיל. נסה שוב.' };
  }

  return { ok: true, data: null };
}

export type Progress = {
  status: string;
  stage: string;
  error: string | null;
  /** מנת העיבוד הנוכחית ומספר המנות. חומר גדול מעובד בכמה מנות. */
  chunkIndex: number;
  chunkCount: number;
};

export async function getProgress(studySetId: string): Promise<Progress | null> {
  const supabase = await createServerSupabase();

  // העובד יכול למות באמצע: Supabase הורגת Edge Function אחרי ~150
  // שניות. בלי הבדיקה הזאת התלמיד נשאר מול מסך "מנתח את החומר" לנצח,
  // והעמודים שנגבו ממנו לא חוזרים. מי שממתין הוא גם מי שמגלה.
  await supabase.rpc('fail_stuck_study_set', { p_study_set_id: studySetId });

  const { data } = await supabase
    .from('study_sets')
    .select('status, stage, error, chunk_index, chunk_count')
    .eq('id', studySetId)
    .maybeSingle();

  if (!data) return null;

  const row = data as {
    status: string;
    stage: string;
    error: string | null;
    chunk_index: number;
    chunk_count: number;
  };

  return {
    status: row.status,
    stage: row.stage,
    error: row.error,
    chunkIndex: row.chunk_index ?? 0,
    chunkCount: row.chunk_count ?? 1,
  };
}
