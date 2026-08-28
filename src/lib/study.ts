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

export type SummarySection = { heading: string; body: string };

export type Summary = {
  body: string;
  /** ריק בחומר שעובד לפני שהפרקים נוספו — אז נופלים חזרה ל-body */
  sections: SummarySection[];
  key_points: string[];
  definitions: { term: string; meaning: string }[];
};

export async function getSummary(studySetId: string): Promise<Summary | null> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('summaries')
    .select('body, sections, key_points, definitions')
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

export type ExamScope = {
  /** null = מבחן משותף על כל החומר */
  topicId: string | null;
  name: string;
  available: number;
};

/**
 * על מה אפשר להיבחן, וכמה שאלות יש לכל נושא.
 *
 * הספירה חשובה למסך: אין טעם להציע מבחן של 20 שאלות על נושא שיש בו 6.
 */
export async function getExamScopes(studySetId: string): Promise<ExamScope[]> {
  const supabase = await createServerSupabase();

  const [{ data: questions }, { data: topics }] = await Promise.all([
    supabase
      .from('questions')
      .select('topic_id')
      .eq('study_set_id', studySetId)
      .eq('kind', 'exam'),
    supabase
      .from('topics')
      .select('id, name')
      .eq('study_set_id', studySetId)
      .order('order_index'),
  ]);

  const rows = questions ?? [];
  if (rows.length === 0) return [];

  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.topic_id) counts.set(row.topic_id, (counts.get(row.topic_id) ?? 0) + 1);
  }

  const perTopic = (topics ?? [])
    .map((topic) => ({
      topicId: topic.id as string,
      name: topic.name as string,
      available: counts.get(topic.id as string) ?? 0,
    }))
    .filter((scope) => scope.available > 0);

  // המשותף ראשון: זה מה שרוב התלמידים ירצו לפני מבחן
  return [{ topicId: null, name: 'כל החומר', available: rows.length }, ...perTopic];
}

export type AttemptResult = {
  score: number;
  questionCount: number;
  finishedAt: string | null;
  answers: {
    questionId: string;
    stem: string;
    options: string[];
    correctIndex: number;
    selectedIndex: number | null;
    isCorrect: boolean;
    explanation: string | null;
    topic: string | null;
  }[];
};

export async function getAttemptResult(attemptId: string): Promise<AttemptResult | null> {
  const supabase = await createServerSupabase();

  const { data: attempt } = await supabase
    .from('attempts')
    .select('score, question_count, finished_at')
    .eq('id', attemptId)
    .maybeSingle();

  if (!attempt) return null;

  const { data: rows } = await supabase
    .from('attempt_answers')
    .select(
      'question_id, selected_index, is_correct, questions(stem, options, correct_index, explanation, topics(name))',
    )
    .eq('attempt_id', attemptId);

  return {
    score: attempt.score ?? 0,
    questionCount: attempt.question_count as number,
    finishedAt: attempt.finished_at as string | null,
    answers: (rows ?? []).map((row) => {
      const q = row.questions as unknown as {
        stem: string;
        options: string[];
        correct_index: number;
        explanation: string | null;
        topics: { name: string } | null;
      };
      return {
        questionId: row.question_id as string,
        stem: q.stem,
        options: q.options,
        correctIndex: q.correct_index,
        selectedIndex: row.selected_index as number | null,
        isCorrect: row.is_correct as boolean,
        explanation: q.explanation,
        topic: q.topics?.name ?? null,
      };
    }),
  };
}

/** נושאים חזקים וחלשים בניסיון אחד, לפי אחוז נכונות */
export function topicBreakdown(result: AttemptResult) {
  const byTopic = new Map<string, { correct: number; total: number }>();
  for (const answer of result.answers) {
    if (!answer.topic) continue;
    const entry = byTopic.get(answer.topic) ?? { correct: 0, total: 0 };
    entry.total += 1;
    if (answer.isCorrect) entry.correct += 1;
    byTopic.set(answer.topic, entry);
  }

  const scored = [...byTopic.entries()].map(([name, e]) => ({
    name,
    percent: Math.round((e.correct / e.total) * 100),
    correct: e.correct,
    total: e.total,
  }));

  return {
    strong: scored.filter((t) => t.percent >= 70).sort((a, b) => b.percent - a.percent),
    weak: scored.filter((t) => t.percent < 70).sort((a, b) => a.percent - b.percent),
  };
}
