import { ExamSetup } from '@/components/study/ExamSetup';
import { getExamScopes } from '@/lib/study';

export default async function ExamPage({ params }: PageProps<'/sets/[id]/exam'>) {
  const { id } = await params;
  // המבחן פתוח לכולם: השאלות כבר נוצרו בעיבוד היחיד, ופתיחת מבחן היא
  // קריאת DB בלבד. גבייה עליה היא גבייה שנייה על אותו חומר.

  const scopes = await getExamScopes(id);

  if (scopes.topics.length === 0) {
    return <p className="text-small text-ink-muted">אין עדיין שאלות מבחן לחומר הזה.</p>;
  }

  return <ExamSetup studySetId={id} scopes={scopes} />;
}
