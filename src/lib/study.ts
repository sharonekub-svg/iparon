import { createServerSupabase } from '@/lib/supabase/server';

/**
 * שכבת הקריאה של החומרים.
 *
 * הכול עובר דרך הלקוח של המשתמש, ולכן RLS היא שמחליטה מה חוזר.
 * אין כאן שום `where user_id = ...` — הוספה כזאת הייתה יוצרת רושם
 * שההגנה כאן, בזמן שהיא במסד.
 */

export type StudySetStatus = 'queued' | 'processing' | 'ready' | 'failed';
export type StudySetStage =
  'queued' | 'reading' | 'analyzing' | 'writing' | 'done' | 'failed';

export type StudySetRow = {
  id: string;
  title: string;
  subject: string | null;
  status: StudySetStatus;
  stage: StudySetStage;
  page_count: number;
  error: string | null;
  created_at: string;
};

export type StudySetListItem = StudySetRow & {
  flashcardCount: number;
  quizCount: number;
  mastery: number | null;
};

export const statusLabels: Record<StudySetStatus, string> = {
  queued: 'ממתין',
  processing: 'בעיבוד',
  ready: 'מוכן',
  failed: 'נכשל',
};

export const stageLabels: Record<StudySetStage, string> = {
  queued: 'החומר התקבל',
  reading: 'קורא את הדפים...',
  analyzing: 'מנתח את החומר ומסדר את הנושאים...',
  writing: 'כותב את הסיכום ובונה שאלות...',
  done: 'מוכן',
  failed: 'העיבוד נכשל',
};

export async function listStudySets(): Promise<StudySetListItem[]> {
  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from('study_sets')
    .select('*, flashcards(count), questions(count)')
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  // מאסטרי ממוצע לכל חומר, מה-VIEW. שאילתה נפרדת כי ה-VIEW לא ניתן
  // לצירוף דרך foreign key.
  const { data: mastery } = await supabase
    .from('topic_mastery')
    .select('study_set_id, mastery');

  const bySet = new Map<string, number[]>();
  for (const row of mastery ?? []) {
    const list = bySet.get(row.study_set_id) ?? [];
    if (typeof row.mastery === 'number') list.push(row.mastery);
    bySet.set(row.study_set_id, list);
  }

  return data.map((row) => {
    const scores = bySet.get(row.id) ?? [];
    return {
      ...(row as unknown as StudySetRow),
      flashcardCount: row.flashcards?.[0]?.count ?? 0,
      quizCount: row.questions?.[0]?.count ?? 0,
      mastery: scores.length
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : null,
    };
  });
}

export async function getStudySet(id: string): Promise<StudySetRow | null> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('study_sets')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  return (data as StudySetRow | null) ?? null;
}

export type Summary = {
  body: string;
  key_points: string[];
  definitions: { term: string; meaning: string }[];
};

export async function getSummary(studySetId: string): Promise<Summary | null> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('summaries')
    .select('body, key_points, definitions')
    .eq('study_set_id', studySetId)
    .maybeSingle();
  return (data as Summary | null) ?? null;
}

export type Flashcard = { id: string; front: string; back: string };

export async function getFlashcards(studySetId: string): Promise<Flashcard[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('flashcards')
    .select('id, front, back')
    .eq('study_set_id', studySetId)
    .order('order_index');
  return (data as Flashcard[] | null) ?? [];
}

export type Question = {
  id: string;
  stem: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
};

export async function getQuestions(
  studySetId: string,
  kind: 'quiz' | 'exam',
): Promise<Question[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('questions')
    .select('id, stem, options, correct_index, explanation')
    .eq('study_set_id', studySetId)
    .eq('kind', kind)
    .order('order_index');
  return (data as Question[] | null) ?? [];
}

export async function getTopics(studySetId: string): Promise<string[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('topics')
    .select('name')
    .eq('study_set_id', studySetId)
    .order('order_index');
  return (data ?? []).map((t) => t.name as string);
}
