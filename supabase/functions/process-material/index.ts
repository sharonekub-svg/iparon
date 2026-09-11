import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.112.3';

import {
  checkCaps,
  db,
  markFailed,
  recordCall,
  setStage,
  writeStudySetChunk,
  purgeSourceFiles,
} from '../_shared/db.ts';
import { env, limits } from '../_shared/env.ts';
import { fail, json, preflight } from '../_shared/http.ts';
import { analyze, sniffMediaType, type FilePart } from '../_shared/model.ts';
import { countPdfPages, slicePdf } from '../_shared/pdf.ts';
import { StudySetError } from '../_shared/studySet.ts';
import { UserError, userMessage } from '../_shared/errors.ts';

/**
 * POST /process-material   { studySetId }
 *
 * העובד היחיד שמדבר עם המודל (כלל ברזל 2). הוא לא מקבל את הקובץ —
 * הוא מוריד אותו מה-Storage לפי מה שרשום ב-documents.
 *
 * **עיבוד במנות.** קובץ טיפוסי הוא 20–60 עמודים, והפעלה אחת ארוכה
 * עליו גם חורגת ממגבלת הזמן של הפונקציה וגם מחזירה סיכום רדוד. לכן
 * כל הפעלה מטפלת במנה אחת של עד 20 עמודים ומעירה את עצמה למנה הבאה.
 * מספר המנה נקרא מהמסד ולא מגוף הבקשה — כך אי אפשר לדלג על מנות
 * מבחוץ.
 *
 * מחזיר 202 מיד וממשיך ברקע; מסך העיבוד עוקב אחרי stage ו-chunk_index.
 */

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

type Page = {
  mediaType: 'application/pdf' | 'image/jpeg' | 'image/png';
  /** הקובץ המקורי. עמודים מאותו PDF חולקים את אותו מערך בתים. */
  bytes: Uint8Array;
  /** מיקום העמוד בתוך הקובץ שלו, מבוסס אפס. */
  pageInFile: number;
};

/** כל העמודים של החומר, לפי סדר, בלי לחתוך עדיין. */
async function readPages(c: SupabaseClient, studySetId: string): Promise<Page[]> {
  const { data: docs, error } = await c
    .from('documents')
    .select('storage_path, size_bytes')
    .eq('study_set_id', studySetId)
    .is('deleted_at', null)
    .order('created_at');

  if (error) throw new Error(error.message);
  if (!docs || docs.length === 0) throw new Error('לא נמצאו קבצים לעיבוד');

  const pages: Page[] = [];
  let total = 0;

  for (const doc of docs) {
    const { data: blob, error: downloadError } = await c.storage
      .from('materials')
      .download(doc.storage_path as string);

    if (downloadError || !blob) throw new Error('storage download failed');

    const bytes = new Uint8Array(await blob.arrayBuffer());
    total += bytes.byteLength;

    if (bytes.byteLength > limits.maxFileBytes) {
      throw new UserError('אחד הקבצים גדול מדי');
    }
    if (total > limits.maxTotalBytes) {
      throw new UserError('סך הקבצים גדול מדי. נסה להעלות פחות עמודים');
    }

    // הסיומת וה-MIME שהלקוח הצהיר עליהם לא נבדקים כאן — רק התוכן.
    const mediaType = sniffMediaType(bytes);
    if (!mediaType) throw new UserError('אחד הקבצים אינו PDF או תמונה תקינים');

    if (mediaType === 'application/pdf') {
      const count = await countPdfPages(bytes);
      for (let i = 0; i < count; i++) {
        pages.push({ mediaType, bytes, pageInFile: i });
      }
    } else {
      pages.push({ mediaType, bytes, pageInFile: 0 });
    }
  }

  return pages;
}

/** הופך מנה של עמודים לבלוקים שנשלחים למודל. */
async function partsForChunk(pages: Page[]): Promise<FilePart[]> {
  const parts: FilePart[] = [];
  let i = 0;

  while (i < pages.length) {
    const page = pages[i];

    if (page.mediaType !== 'application/pdf') {
      parts.push({ mediaType: page.mediaType, base64: encodeBase64(page.bytes) });
      i++;
      continue;
    }

    // עמודים רצופים מאותו PDF נחתכים יחד למסמך אחד, כדי שהמודל יראה
    // רצף ולא ערימת דפים מנותקים.
    const from = page.pageInFile;
    let to = from + 1;
    while (
      i + (to - from) < pages.length &&
      pages[i + (to - from)].mediaType === 'application/pdf' &&
      pages[i + (to - from)].bytes === page.bytes &&
      pages[i + (to - from)].pageInFile === to
    ) {
      to++;
    }

    const sliced = await slicePdf(page.bytes, from, to);
    parts.push({ mediaType: 'application/pdf', base64: encodeBase64(sliced) });
    i += to - from;
  }

  return parts;
}

async function process(
  c: SupabaseClient,
  studySetId: string,
  userId: string,
): Promise<void> {
  try {
    await setStage(c, studySetId, 'reading');

    const { data: set } = await c
      .from('study_sets')
      .select('chunk_index, chunk_count, credits_charged, pages_charged')
      .eq('id', studySetId)
      .single();

    const chunkIndex = (set?.chunk_index as number) ?? 0;
    const pages = await readPages(c, studySetId);

    if (pages.length > limits.maxPages) {
      throw new UserError(
        `החומר מכיל ${pages.length} עמודים, ואפשר לעבד עד ${limits.maxPages} בחומר אחד. נסה להעלות אותו בשני חלקים`,
      );
    }

    const chunkCount = Math.max(1, Math.ceil(pages.length / limits.maxPagesPerChunk));
    // חלוקה שווה: 26 עמודים הם שתי מנות של 13, ולא מנה של 25 ומנה של 1.
    const perChunk = Math.ceil(pages.length / chunkCount);

    if (chunkIndex === 0) {
      // הגבייה היא על מספר העמודים האמיתי, אחרי הספירה ולפני הקריאה
      // הראשונה למודל. יתרה שאינה מספיקה עוצרת כאן, בלי לעלות כסף.
      const { error: chargeError } = await c.rpc('consume_pages', {
        p_study_set_id: studySetId,
        p_pages: pages.length,
      });

      if (chargeError) {
        // חיוב מינימלי של 5 עמודים — מתועד ב-docs/PLAN.md סעיף 7א.
        const charged = Math.max(pages.length, 5);
        throw new UserError(
          chargeError.message.includes('מספיק')
            ? `לחומר הזה צריך ${charged} עמודים, ואין לך מספיק ביתרה.`
            : 'לא הצלחנו לחייב את היתרה. נסה שוב.',
        );
      }

      await c
        .from('study_sets')
        .update({ page_count: pages.length, chunk_count: chunkCount })
        .eq('id', studySetId);
    }

    const from = chunkIndex * perChunk;
    const chunk = pages.slice(from, from + perChunk);
    if (chunk.length === 0) throw new Error(`מנה ריקה: ${chunkIndex}/${chunkCount}`);

    const parts = await partsForChunk(chunk);

    await setStage(c, studySetId, 'analyzing');
    const { studySet, usage } = await analyze(parts, chunk.length);

    await recordCall(c, { userId, studySetId, model: env.model, usage, ok: true });

    await setStage(c, studySetId, 'writing');
    const isLast = chunkIndex + 1 >= chunkCount;
    await writeStudySetChunk(c, studySetId, studySet, {
      first: chunkIndex === 0,
      last: isLast,
    });

    if (!isLast) {
      // המנה הבאה בהפעלה נפרדת: כל הפעלה מתחילה את שעון הזמן מחדש.
      await c
        .from('study_sets')
        .update({ chunk_index: chunkIndex + 1, claimed_at: null })
        .eq('id', studySetId);

      await continueNextChunk(studySetId);
      return;
    }

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

    // רק שגיאה שנזרקה במפורש כ-UserError מגיעה למסך. השאר — הודעה
    // כללית, כדי שתקלת תצורה או כשל של ספק לא ייראו כמו באג בקובץ
    // של התלמיד, ולא יספרו לו איך המערכת בנויה.
    await markFailed(
      c,
      studySetId,
      error instanceof StudySetError
        ? 'העיבוד הצליח אבל התוצאה לא הייתה במבנה הצפוי. נסה שוב.'
        : userMessage(error),
    );
  }
}

/**
 * מעיר את הפונקציה למנה הבאה. הקריאה היא שרת-לשרת עם service role,
 * ולכן היא לא תלויה ב-session של התלמיד — שאולי כבר סגר את הדפדפן.
 */
async function continueNextChunk(studySetId: string): Promise<void> {
  const response = await fetch(`${env.supabaseUrl}/functions/v1/process-material`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.serviceRoleKey}`,
    },
    body: JSON.stringify({ studySetId }),
  });

  if (!response.ok) {
    console.error('[process-material] המשך מנה נכשל', studySetId, response.status);
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

  // תביעת בעלות על העיבוד. שתי הפעלות במקביל על אותו חומר היו
  // מייצרות תוכן כפול ומחייבות פעמיים את המודל.
  const { data: claimed } = await c.rpc('claim_study_set', {
    p_study_set_id: studySetId,
  });

  if (!claimed) return json({ accepted: false, reason: 'כבר בעיבוד' }, 202);

  const work = process(c, studySetId, set.user_id as string);
  if (typeof EdgeRuntime !== 'undefined') {
    EdgeRuntime.waitUntil(work);
  } else {
    await work;
  }

  return json({ accepted: true }, 202);
});
