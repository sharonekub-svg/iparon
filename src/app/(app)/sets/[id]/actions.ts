'use server';

import { createServerSupabase } from '@/lib/supabase/server';

/**
 * כל הכתיבות של מסכי הלימוד.
 *
 * הן רצות בשרת ולא בדפדפן, משתי סיבות:
 *   1. הדפדפן היה צריך לדבר ישירות מול Supabase, וזו בקשה חוצת־מקורות
 *      שתלויה ב-CORS ובתעבורה שלא בשליטתנו. כאן זו קריאה שרת-לשרת.
 *   2. כישלון שקט. הגרסה הקודמת שלחה את הדירוג ושכחה ממנו, והמסך
 *      התקדם לכרטיסייה הבאה כאילו הכול תקין — גם כשהכתיבה נפלה.
 *
 * ה-session של המשתמש מגיע מה-cookies, ולכן RLS חלה בדיוק כמו קודם.
 */

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function rateFlashcard(
  flashcardId: string,
  rating: number,
): Promise<ActionResult<null>> {
  if (!Number.isInteger(rating) || rating < 0 || rating > 2) {
    return { ok: false, error: 'דירוג לא תקין' };
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: 'לא מחובר' };

  const { error } = await supabase
    .from('flashcard_reviews')
    .insert({ user_id: user.id, flashcard_id: flashcardId, rating });

  if (error) {
    console.error('[flashcard:rate]', error.message);
    return { ok: false, error: 'הדירוג לא נשמר' };
  }

  return { ok: true, data: null };
}

export type StartedExam = {
  attemptId: string;
  questions: { id: string; stem: string; options: string[] }[];
};

export async function startExam(
  studySetId: string,
  topicId: string | null,
  count: number,
): Promise<ActionResult<StartedExam>> {
  const supabase = await createServerSupabase();

  const { data, error } = await supabase.rpc('start_exam', {
    p_study_set_id: studySetId,
    p_topic_id: topicId,
    p_count: count,
  });

  if (error || !data || data.length === 0) {
    console.error('[exam:start]', error?.message ?? 'no rows');
    return { ok: false, error: 'לא הצלחנו לפתוח את המבחן. נסה שוב.' };
  }

  type Row = { attempt_id: string; question_id: string; stem: string; options: string[] };
  const rows = data as Row[];

  return {
    ok: true,
    data: {
      attemptId: rows[0].attempt_id,
      questions: rows.map((r) => ({
        id: r.question_id,
        stem: r.stem,
        options: r.options,
      })),
    },
  };
}

export async function submitExam(
  attemptId: string,
  answers: { question_id: string; selected_index: number }[],
): Promise<ActionResult<number>> {
  const supabase = await createServerSupabase();

  const { data, error } = await supabase.rpc('submit_exam', {
    p_attempt_id: attemptId,
    p_answers: answers,
  });

  if (error) {
    console.error('[exam:submit]', error.message);
    return { ok: false, error: 'ההגשה נכשלה. נסה שוב.' };
  }

  return { ok: true, data: (data as number) ?? 0 };
}
