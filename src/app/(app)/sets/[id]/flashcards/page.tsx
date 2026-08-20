import { FlashcardDeck } from '@/components/study/FlashcardDeck';
import { getFlashcards } from '@/lib/study';

export default async function FlashcardsPage({
  params,
}: PageProps<'/sets/[id]/flashcards'>) {
  const { id } = await params;
  const cards = await getFlashcards(id);

  if (cards.length === 0) {
    return <p className="text-small text-ink-muted">אין עדיין כרטיסיות לחומר הזה.</p>;
  }

  return <FlashcardDeck cards={cards} />;
}
