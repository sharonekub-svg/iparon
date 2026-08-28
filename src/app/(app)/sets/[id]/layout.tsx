import Link from 'next/link';
import { notFound } from 'next/navigation';

import { DeleteStudySet } from '@/components/study/DeleteStudySet';
import { StudySetTitle } from '@/components/study/StudySetTitle';
import { StudyTabs } from '@/components/study/StudyTabs';
import { IconArrow } from '@/components/ui/IconArrow';
import { getStudySet } from '@/lib/study';

export default async function StudySetLayout({
  children,
  params,
}: LayoutProps<'/sets/[id]'>) {
  const { id } = await params;
  const set = await getStudySet(id);

  if (!set) notFound();

  return (
    <>
      <Link
        href="/dashboard"
        className="text-meta text-ink-faint hover:text-ink tap -ms-3 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3"
      >
        <IconArrow direction="back" className="size-3.5" />
        חזרה לחומרים
      </Link>

      <StudySetTitle studySetId={id} initialTitle={set.title} />
      <p className="text-meta text-ink-faint mt-1.5">
        {set.subject ? `${set.subject} · ` : ''}
        <span className="num">{set.page_count}</span> עמודים
      </p>

      <StudyTabs id={id} />

      <div className="mt-6">{children}</div>

      <div className="border-line mt-12 border-t pt-6">
        <DeleteStudySet studySetId={id} />
      </div>
    </>
  );
}
