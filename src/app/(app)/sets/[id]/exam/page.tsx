import { ExamSetup } from '@/components/study/ExamSetup';
import { getExamScopes } from '@/lib/study';

export default async function ExamPage({ params }: PageProps<'/sets/[id]/exam'>) {
  const { id } = await params;
  const scopes = await getExamScopes(id);

  if (scopes.length === 0) {
    return <p className="text-small text-ink-muted">אין עדיין שאלות מבחן לחומר הזה.</p>;
  }

  return <ExamSetup studySetId={id} scopes={scopes} />;
}
