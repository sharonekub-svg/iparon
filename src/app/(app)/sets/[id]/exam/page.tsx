import Link from 'next/link';

import { ExamSetup } from '@/components/study/ExamSetup';
import { getEntitlements } from '@/lib/plans';
import { getExamScopes } from '@/lib/study';

export default async function ExamPage({ params }: PageProps<'/sets/[id]/exam'>) {
  const { id } = await params;
  const entitlements = await getEntitlements();

  // החסימה כאן היא UX. האכיפה היא ב-start_exam, שדוחה גם קריאה ישירה.
  if (!entitlements.examsEnabled) {
    return (
      <div className="border-line-strong bg-surface shadow-card rounded-2xl border px-5 py-8">
        <h2 className="text-heading text-ink">מבחני תרגול במסלול המורחב</h2>
        <p className="text-small text-ink-body mt-2">
          מבחן תרגול בונה לך מבחן מהחומר — על נושא אחד, על צירוף של כמה, או על הכול —
          ומראה בסוף במה אתה חזק ובמה כדאי לחזור.
        </p>
        <Link
          href="/premium"
          className="bg-ink text-on-ink text-label tap mt-6 inline-block rounded-lg px-6 py-3.5 hover:opacity-90"
        >
          מה כלול במסלול
        </Link>
      </div>
    );
  }

  const scopes = await getExamScopes(id);

  if (scopes.topics.length === 0) {
    return <p className="text-small text-ink-muted">אין עדיין שאלות מבחן לחומר הזה.</p>;
  }

  return <ExamSetup studySetId={id} scopes={scopes} />;
}
