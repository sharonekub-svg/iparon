import { QuizSetup } from '@/components/study/QuizSetup';
import { getQuestions } from '@/lib/study';

export default async function QuizPage({ params }: PageProps<'/sets/[id]/quiz'>) {
  const { id } = await params;
  const questions = await getQuestions(id, 'quiz');

  if (questions.length === 0) {
    return <p className="text-small text-ink-muted">אין עדיין שאלות תרגול לחומר הזה.</p>;
  }

  return <QuizSetup questions={questions} studySetId={id} />;
}
