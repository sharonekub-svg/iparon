'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

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

export async function recordQuizAttempt(
  studySetId: string,
  answers: { question_id: string; selected_index: number }[],
): Promise<ActionResult<number>> {
  const supabase = await createServerSupabase();

  const { data, error } = await supabase.rpc('record_quiz_attempt', {
    p_study_set_id: studySetId,
    p_answers: answers,
  });

  if (error) {
    console.error('[quiz:record]', error.message);
    return { ok: false, error: 'התוצאה לא נשמרה' };
  }

  return { ok: true, data: (data as number) ?? 0 };
}

/**
 * ניסיון עיבוד חוזר על חומר שנכשל.
 *
 * הקבצים כבר באחסון, ולכן אין העלאה מחדש ואין מכסה נוספת — זו אותה
 * שורה, אותם מסמכים, קריאה שנייה לעובד.
 */
export async function retryProcessing(studySetId: string): Promise<ActionResult<null>> {
  const supabase = await createServerSupabase();

  const { data: set } = await supabase
    .from('study_sets')
    .select('status')
    .eq('id', studySetId)
    .maybeSingle();

  if (!set) return { ok: false, error: 'החומר לא נמצא' };
  if (set.status !== 'failed') {
    return { ok: false, error: 'אפשר לנסות שוב רק חומר שנכשל' };
  }

  const { count } = await supabase
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .eq('study_set_id', studySetId)
    .is('deleted_at', null);

  if (!count) {
    return { ok: false, error: 'הקבצים כבר לא קיימים. צריך להעלות מחדש.' };
  }

  const { error } = await supabase.functions.invoke('process-material', {
    body: { studySetId },
  });

  if (error) {
    console.error('[retry:invoke]', error.message);
    return { ok: false, error: 'ההפעלה מחדש נכשלה. נסה שוב.' };
  }

  return { ok: true, data: null };
}

/**
 * מחיקת חומר. ה-cascade מוריד איתו נושאים, סיכום, כרטיסיות, שאלות
 * וניסיונות. קבצי המקור באחסון נמחקים כאן במפורש, כי Storage לא
 * מקושר ל-FK.
 */
export async function deleteStudySet(studySetId: string): Promise<void> {
  const supabase = await createServerSupabase();

  const { data: docs } = await supabase
    .from('documents')
    .select('storage_path')
    .eq('study_set_id', studySetId);

  const paths = (docs ?? []).map((d) => d.storage_path as string);
  if (paths.length > 0) {
    const { error } = await supabase.storage.from('materials').remove(paths);
    if (error) console.error('[delete:storage]', error.message);
  }

  const { error } = await supabase.from('study_sets').delete().eq('id', studySetId);
  if (error) {
    console.error('[delete:set]', error.message);
    return;
  }

  revalidatePath('/dashboard');
  redirect('/dashboard');
}

/**
 * שינוי שם לחומר.
 *
 * ל-authenticated יש grant של update על עמודת title בלבד, ולכן גם אם
 * מישהו יקרא ל-API ישירות הוא לא יוכל לגעת ב-status או ב-stage.
 */
export async function renameStudySet(
  studySetId: string,
  title: string,
): Promise<ActionResult<string>> {
  const trimmed = title.trim();

  if (trimmed.length === 0) return { ok: false, error: 'צריך שם' };
  if (trimmed.length > 200) return { ok: false, error: 'השם ארוך מדי' };

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from('study_sets')
    .update({ title: trimmed })
    .eq('id', studySetId);

  if (error) {
    console.error('[set:rename]', error.message);
    return { ok: false, error: 'השם לא נשמר' };
  }

  revalidatePath(`/sets/${studySetId}`);
  revalidatePath('/dashboard');
  return { ok: true, data: trimmed };
}
