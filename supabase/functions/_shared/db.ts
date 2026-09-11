import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.112.3';

import { env } from './env.ts';
import type { ModelUsage } from './model.ts';
import { summaryText, type StudySet } from './studySet.ts';

export function db(): SupabaseClient {
  return createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type Stage = 'queued' | 'reading' | 'analyzing' | 'writing' | 'done' | 'failed';

export async function setStage(
  c: SupabaseClient,
  id: string,
  stage: Stage,
): Promise<void> {
  await c.from('study_sets').update({ stage, status: 'processing' }).eq('id', id);
}

export async function markFailed(
  c: SupabaseClient,
  id: string,
  message: string,
): Promise<void> {
  await c
    .from('study_sets')
    .update({ status: 'failed', stage: 'failed', error: message })
    .eq('id', id);
}

/**
 * כלל ברזל 7: כל קריאה נרשמת, כולל כשלונות. קריאה שנפלה אחרי שהמודל
 * כבר עבד עלתה כסף, ותקרה שסופרת רק הצלחות היא תקרה שקרית.
 */
export async function recordCall(
  c: SupabaseClient,
  row: {
    userId: string | null;
    studySetId: string;
    model: string;
    usage?: ModelUsage;
    ok: boolean;
    error?: string;
  },
): Promise<void> {
  await c.from('model_calls').insert({
    user_id: row.userId,
    study_set_id: row.studySetId,
    model: row.model,
    input_tokens: row.usage?.inputTokens ?? 0,
    output_tokens: row.usage?.outputTokens ?? 0,
    cache_read_tokens: row.usage?.cacheReadTokens ?? 0,
    cost_usd: row.usage?.costUsd ?? 0,
    ok: row.ok,
    error: row.error ?? null,
  });
}

export type CapCheck = { allowed: true } | { allowed: false; reason: string };

/** שתי תקרות: גלובלית על ההוצאה, ואישית על מספר ההעלאות. */
export async function checkCaps(c: SupabaseClient, userId: string): Promise<CapCheck> {
  const { data: caps } = await c.from('usage_caps').select('*').single();
  if (!caps) return { allowed: true };

  const { data: usage } = await c.rpc('month_usage').single();
  const calls = (usage as { calls?: number } | null)?.calls ?? 0;
  const cost = Number((usage as { cost_usd?: number } | null)?.cost_usd ?? 0);

  if (calls >= caps.max_calls_per_month) {
    return {
      allowed: false,
      reason: 'המערכת הגיעה למכסת העיבודים החודשית. נסה שוב בחודש הבא.',
    };
  }
  if (cost >= Number(caps.max_cost_usd_per_month)) {
    return { allowed: false, reason: 'המערכת הגיעה למסגרת החודשית. נסה שוב בחודש הבא.' };
  }

  const { data: mine } = await c.rpc('user_uploads_this_month', { target_user: userId });
  if (((mine as number) ?? 0) >= caps.max_uploads_per_user_per_month) {
    return {
      allowed: false,
      reason: `הגעת למכסה החודשית שלך (${caps.max_uploads_per_user_per_month} העלאות). המכסה מתאפסת בתחילת החודש.`,
    };
  }

  return { allowed: true };
}

/**
 * כתיבת התוצאה. הסדר חשוב: קודם נושאים, כי כל השאר מצביע אליהם.
 * שיוך לפי שם הנושא — המודל מחזיר את השם, לא מזהה.
 */
/**
 * כתיבת תוצאת מנה אחת.
 *
 * חומר גדול מעובד בכמה מנות, וכל מנה מחזירה סיכום משלה. המנה הראשונה
 * כותבת, והבאות **מצטרפות**: נושא שכבר קיים לא נוצר שוב, וכרטיסיות
 * ושאלות נדחפות לסוף. רק המנה האחרונה מסמנת את החומר כמוכן — אחרת
 * התלמיד היה נכנס לחומר חצי מעובד וחושב שזה הכול.
 */
export async function writeStudySetChunk(
  c: SupabaseClient,
  studySetId: string,
  set: StudySet,
  chunk: { first: boolean; last: boolean },
): Promise<void> {
  const topicId = await upsertTopics(c, studySetId, set.topics);
  const resolve = (name: string) => topicId.get(name.trim()) ?? null;

  await mergeSummary(c, studySetId, set, chunk.first);

  if (set.flashcards.length > 0) {
    const offset = await nextOrderIndex(c, 'flashcards', studySetId);
    await c.from('flashcards').insert(
      set.flashcards.map((card, i) => ({
        study_set_id: studySetId,
        topic_id: resolve(card.topic),
        front: card.q,
        back: card.a,
        order_index: offset + i,
      })),
    );
  }

  const questions = [
    ...set.quiz_questions.map((q, i) => ({ ...q, kind: 'quiz' as const, i })),
    ...set.exam_questions.map((q, i) => ({ ...q, kind: 'exam' as const, i })),
  ];

  if (questions.length > 0) {
    const offset = await nextOrderIndex(c, 'questions', studySetId);
    await c.from('questions').insert(
      questions.map((q) => ({
        study_set_id: studySetId,
        topic_id: resolve(q.topic),
        kind: q.kind,
        stem: q.q,
        options: q.options,
        correct_index: q.correct,
        explanation: q.explanation || null,
        order_index: offset + q.i,
      })),
    );
  }

  // הכותרת והמקצוע נקבעים לפי המנה הראשונה: היא בדרך כלל תחילת החומר,
  // ושם הכותרת אמיתית. מנה 3 של פרק באמצע תיתן כותרת מטעה.
  const fields: Record<string, unknown> = chunk.first
    ? { subject: set.subject.slice(0, 60), title: set.title.slice(0, 200) }
    : {};

  if (chunk.last) {
    fields.status = 'ready';
    fields.stage = 'done';
    fields.error = null;
  }

  if (Object.keys(fields).length > 0) {
    await c.from('study_sets').update(fields).eq('id', studySetId);
  }
}

/** מחזיר מזהה לכל נושא בחומר, ויוצר רק את מי שעוד לא קיים. */
async function upsertTopics(
  c: SupabaseClient,
  studySetId: string,
  names: string[],
): Promise<Map<string, string>> {
  const { data: existing } = await c
    .from('topics')
    .select('id, name, order_index')
    .eq('study_set_id', studySetId);

  const map = new Map<string, string>(
    (existing ?? []).map((t) => [t.name as string, t.id as string]),
  );

  const missing = names.map((n) => n.trim()).filter((n) => n && !map.has(n));
  if (missing.length === 0) return map;

  const offset = (existing ?? []).reduce(
    (max, t) => Math.max(max, ((t.order_index as number) ?? -1) + 1),
    0,
  );

  const { data: inserted } = await c
    .from('topics')
    .insert(
      missing.map((name, i) => ({
        study_set_id: studySetId,
        name,
        order_index: offset + i,
      })),
    )
    .select('id, name');

  for (const row of inserted ?? []) {
    map.set(row.name as string, row.id as string);
  }

  return map;
}

/** הסיכום הוא שורה אחת לחומר, ולכן מנה שנייה מאריכה אותה ולא כותבת שנייה. */
async function mergeSummary(
  c: SupabaseClient,
  studySetId: string,
  set: StudySet,
  first: boolean,
): Promise<void> {
  if (first) {
    await c.from('summaries').insert({
      study_set_id: studySetId,
      body: summaryText(set.summary_sections),
      sections: set.summary_sections,
      key_points: set.key_points,
      definitions: set.definitions,
    });
    return;
  }

  const { data: current } = await c
    .from('summaries')
    .select('body, sections, key_points, definitions')
    .eq('study_set_id', studySetId)
    .maybeSingle();

  if (!current) {
    // המנה הראשונה נכשלה בכתיבה. עדיף סיכום חלקי מאשר חומר בלי סיכום.
    await c.from('summaries').insert({
      study_set_id: studySetId,
      body: summaryText(set.summary_sections),
      sections: set.summary_sections,
      key_points: set.key_points,
      definitions: set.definitions,
    });
    return;
  }

  const sections = [
    ...((current.sections as unknown[]) ?? []),
    ...set.summary_sections,
  ];

  await c
    .from('summaries')
    .update({
      body: `${current.body as string}\n\n${summaryText(set.summary_sections)}`,
      sections,
      key_points: [
        ...((current.key_points as unknown[]) ?? []),
        ...set.key_points,
      ],
      definitions: [
        ...((current.definitions as unknown[]) ?? []),
        ...set.definitions,
      ],
    })
    .eq('study_set_id', studySetId);
}

/** המיקום הפנוי הבא, כדי שמנה שנייה לא תדרוס את הסדר של הראשונה. */
async function nextOrderIndex(
  c: SupabaseClient,
  table: 'flashcards' | 'questions',
  studySetId: string,
): Promise<number> {
  const { data } = await c
    .from(table)
    .select('order_index')
    .eq('study_set_id', studySetId)
    .order('order_index', { ascending: false })
    .limit(1)
    .maybeSingle();

  return ((data?.order_index as number) ?? -1) + 1;
}

export async function purgeSourceFiles(
  c: SupabaseClient,
  studySetId: string,
): Promise<void> {
  const { data: docs } = await c
    .from('documents')
    .select('id, storage_path')
    .eq('study_set_id', studySetId)
    .is('deleted_at', null);

  if (!docs || docs.length === 0) return;

  const paths = docs.map((d) => d.storage_path as string);
  const { error } = await c.storage.from('materials').remove(paths);

  if (error) {
    // לא מפילים את העיבוד בגלל ניקיון. החומר מוכן, והקובץ יימחק בפעם הבאה.
    console.error('[purge]', studySetId, error.message);
    return;
  }

  await c
    .from('documents')
    .update({ deleted_at: new Date().toISOString() })
    .in('id', docs.map((d) => d.id as string));
}
