import { ProcessingStatus } from '@/components/study/ProcessingStatus';

export const metadata = { title: 'מעבד את החומר' };

export default async function ProcessingPage({
  params,
}: PageProps<'/sets/[id]/processing'>) {
  const { id } = await params;
  return <ProcessingStatus studySetId={id} />;
}
