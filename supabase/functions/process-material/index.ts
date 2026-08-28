import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.112.3';

import {
  checkCaps,
  db,
  markFailed,
  recordCall,
  setStage,
  writeStudySet,
  purgeSourceFiles,
} from '../_shared/db.ts';
import { env, limits } from '../_shared/env.ts';
import { fail, json, preflight } from '../_shared/http.ts';
import { analyze, sniffMediaType, type FilePart } from '../_shared/model.ts';
import { countPdfPages } from '../_shared/pdf.ts';
import { StudySetError } from '../_shared/studySet.ts';

/**
 * POST /process-material   { studySetId }
 *
 * העובד היחיד שמדבר עם המודל (כלל ברזל 2). הוא לא מקבל את הקובץ —
 * הוא מוריד אותו מה-Storage לפי מה שרשום ב-documents, וכך גם קובץ של
 * 15MB לא עובר פעמיים ברשת ולא נתקל במגבלת גוף הבקשה.
 *
 * מחזיר 202 מיד וממשיך ברקע: קריאה למודל על דף סרוק לוקחת עשרות שניות
 * ולפעמים יותר, וזה ארוך מדי כדי להשאיר תלמיד מול מסך טעינה על רשת
 * סלולרית. מסך העיבוד עוקב אחרי עמודת stage.
 */

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

async function process(
  c: SupabaseClient,
  studySetId: string,
  userId: string,
): Promise<void> {
  try {
    await setStage(c, studySetId, 'reading');

    const { data: docs, error: docsError } = await c
      .from('documents')
      .select('storage_path, size_bytes')
      .eq('study_set_id', studySetId)
      .is('deleted_at', null)
      .order('created_at');

    if (docsError) throw new Error(docsError.message);
    if (!docs || docs.length === 0) throw new Error('לא נמצאו קבצים לעיבוד');

    const parts: FilePart[] = [];
    let total = 0;
    // תמונה = עמוד אחד. PDF = מספר העמודים שבו.
    let pages = 0;

    for (const doc of docs) {
      const { data: blob, error } = await c.storage
        .from('materials')
        .download(doc.storage_path as string);

      if (error || !blob) throw new Error('הורדת הקובץ נכשלה');

      const bytes = new Uint8Array(await blob.arrayBuffer());
      total += bytes.byteLength;

      if (bytes.byteLength > limits.maxFileBytes) {
        throw new Error('אחד הקבצים גדול מדי');
      }
      if (total > limits.maxTotalBytes) {
        throw new Error('סך הקבצים גדול מדי. נסה להעלות פחות עמודים');
      }

      // הסיומת וה-MIME שהלקוח הצהיר עליהם לא נבדקים כאן — רק התוכן.
      const mediaType = sniffMediaType(bytes);
      if (!mediaType) {
        throw new Error('אחד הקבצים אינו PDF או תמונה תקינים');
      }

      if (mediaType === 'application/pdf') {
        pages += await countPdfPages(bytes);
      } else {
        pages += 1;
      }

      if (pages > limits.maxPages) {
        throw new Error(
          `החומר מכיל ${pages} עמודים, ואפשר לעבד עד ${limits.maxPages} בבת אחת. נסה להעלות פחות עמודים`,
        );
      }

      parts.push({ mediaType, base64: encodeBase64(bytes) });
    }

    // מספר העמודים האמיתי. קודם נשמר כאן מספר הקבצים, ולכן PDF של
    // 30 עמודים הוצג בדשבורד כ"עמוד אחד".
    await c.from('study_sets').update({ page_count: pages }).eq('id', studySetId);

    await setStage(c, studySetId, 'analyzing');
    const { studySet, usage } = await analyze(parts);

    await recordCall(c, { userId, studySetId, model: env.model, usage, ok: true });

    await setStage(c, studySetId, 'writing');
    await writeStudySet(c, studySetId, studySet);

    // החומר מוכן, ולקובץ אין יותר שימוש.
    await purgeSourceFiles(c, studySetId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'שגיאה לא מזוהה';
    console.error('[process-material]', studySetId, message);

    // גם כשל נרשם: קריאה שנפלה אחרי שהמודל כבר עבד עלתה כסף.
    await recordCall(c, {
      userId,
      studySetId,
      model: env.model,
      ok: false,
      error: message.slice(0, 500),
    });

    await markFailed(
      c,
      studySetId,
      error instanceof StudySetError
        ? 'העיבוד הצליח אבל התוצאה לא הייתה במבנה הצפוי. נסה שוב.'
        : message,
    );
  }
}

/** btoa על מחרוזת ארוכה נופל; מקודדים במנות. */
function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return preflight();
  if (request.method !== 'POST') return fail('method_not_allowed', 'השתמש ב-POST', 405);

  let body: { studySetId?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail('invalid_json', 'גוף הבקשה אינו JSON תקין', 400);
  }

  const studySetId = body.studySetId;
  if (typeof studySetId !== 'string' || !studySetId.trim()) {
    return fail('missing_id', 'חסר מזהה חומר', 400);
  }

  const c = db();

  // הבעלות נקבעת מהרשומה עצמה, לא ממה שהלקוח שלח.
  const { data: set } = await c
    .from('study_sets')
    .select('id, user_id, status')
    .eq('id', studySetId)
    .maybeSingle();

  if (!set) return fail('not_found', 'החומר לא נמצא', 404);

  // עיבוד חוזר על חומר שכבר מוכן הוא באג (כלל ברזל 3), ולא בקשה לגיטימית.
  if (set.status === 'ready') {
    return fail('already_processed', 'החומר כבר עובד', 409);
  }

  try {
    const cap = await checkCaps(c, set.user_id as string);
    if (!cap.allowed) {
      await markFailed(c, studySetId, cap.reason);
      return fail('cap_reached', cap.reason, 429);
    }
  } catch (error) {
    console.error('[process-material] cap check failed', error);
    return fail('cap_check_failed', 'בדיקת המסגרת החודשית נכשלה', 500);
  }

  const work = process(c, studySetId, set.user_id as string);
  if (typeof EdgeRuntime !== 'undefined') {
    EdgeRuntime.waitUntil(work);
  } else {
    await work;
  }

  return json({ accepted: true }, 202);
});
