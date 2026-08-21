import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.112.3';

import { env } from './env.ts';
import type { ModelUsage } from './model.ts';
import type { StudySet } from './studySet.ts';

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
  if (((mine as number) ?? 0) > caps.max_uploads_per_user_per_month) {
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
export async function writeStudySet(
  c: SupabaseClient,
  studySetId: string,
  set: StudySet,
): Promise<void> {
  const { data: topicRows } = await c
    .from('topics')
    .insert(
      set.topics.map((name, i) => ({ study_set_id: studySetId, name, order_index: i })),
    )
    .select('id, name');

  const topicId = new Map(
    (topicRows ?? []).map((t) => [t.name as string, t.id as string]),
  );
  const resolve = (name: string) => topicId.get(name.trim()) ?? null;

  await c.from('summaries').insert({
    study_set_id: studySetId,
    body: set.summary,
    key_points: set.key_points,
    definitions: set.definitions,
  });

  if (set.flashcards.length > 0) {
    await c.from('flashcards').insert(
      set.flashcards.map((card, i) => ({
        study_set_id: studySetId,
        topic_id: resolve(card.topic),
        front: card.q,
        back: card.a,
        order_index: i,
      })),
    );
  }

  const questions = [
    ...set.quiz_questions.map((q, i) => ({ ...q, kind: 'quiz' as const, i })),
    ...set.exam_questions.map((q, i) => ({ ...q, kind: 'exam' as const, i })),
  ];

  if (questions.length > 0) {
    await c.from('questions').insert(
      questions.map((q) => ({
        study_set_id: studySetId,
        topic_id: resolve(q.topic),
        kind: q.kind,
        stem: q.q,
        options: q.options,
        correct_index: q.correct,
        explanation: q.explanation || null,
        order_index: q.i,
      })),
    );
  }

  await c
    .from('study_sets')
    .update({
      status: 'ready',
      stage: 'done',
      subject: set.subject.slice(0, 60),
      title: set.title.slice(0, 200),
      error: null,
    })
    .eq('id', studySetId);
}
