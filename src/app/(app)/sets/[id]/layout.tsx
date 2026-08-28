import Link from 'next/link';
import { notFound } from 'next/navigation';

import { DeleteStudySet } from '@/components/study/DeleteStudySet';
import { StudySetTitle } from '@/components/study/StudySetTitle';
import { StudyTabs } from '@/components/study/StudyTabs';
import { getEntitlements } from '@/lib/plans';
import { getStudySet } from '@/lib/study';

export default async function StudySetLayout({
  children,
  params,
}: LayoutProps<'/sets/[id]'>) {
  const { id } = await params;
  const [set, entitlements] = await Promise.all([getStudySet(id), getEntitlements()]);

  if (!set) notFound();

  return (
    <>
      <Link href="/dashboard" className="text-meta text-ink-faint hover:text-ink">
        חזרה לחומרים
      </Link>

      <StudySetTitle studySetId={id} initialTitle={set.title} />
      <p className="text-meta text-ink-faint mt-1.5">
        {set.subject ? `${set.subject} · ` : ''}
        <span className="num">{set.page_count}</span> עמודים
      </p>

      <StudyTabs id={id} examsLocked={!entitlements.examsEnabled} />

      <div className="mt-6">{children}</div>

      <div className="border-line mt-12 border-t pt-6">
        <DeleteStudySet studySetId={id} />
      </div>
    </>
  );
}
