import { SummaryView } from '@/components/study/SummaryView';
import { getSummary, getTopics } from '@/lib/study';

export default async function SummaryPage({ params }: PageProps<'/sets/[id]'>) {
  const { id } = await params;
  const [summary, topics] = await Promise.all([getSummary(id), getTopics(id)]);

  if (!summary) {
    return <p className="text-small text-ink-muted">אין עדיין סיכום לחומר הזה.</p>;
  }

  return <SummaryView summary={summary} topics={topics} />;
}
