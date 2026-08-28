'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * שלוש הלשוניות של החומר.
 *
 * המבחן הוסר מהניווט לבקשת המוצר: התרגול קיבל בחירת היקף, והוא מכסה
 * את אותו צורך בלי לפצל את המסך לשניים. המסלול `/sets/[id]/exam` והקוד
 * שלו נשארו במקומם, כך שהחזרה שלו היא שורה אחת כאן.
 */
const tabs = [
  { slug: '', label: 'סיכום' },
  { slug: '/flashcards', label: 'כרטיסיות' },
  { slug: '/quiz', label: 'תרגול' },
] as const;

export function StudyTabs({ id }: { id: string }) {
  const pathname = usePathname();
  const base = `/sets/${id}`;

  return (
    <nav
      className="bg-surface-sunk mt-6 flex gap-1 rounded-full p-1"
      aria-label="חלקי החומר"
    >
      {tabs.map((tab) => {
        const href = `${base}${tab.slug}`;
        const active = pathname === href;

        return (
          <Link
            key={tab.slug}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`text-label tap flex-1 rounded-full px-3.5 py-2.5 text-center ${
              active ? 'bg-surface text-ink shadow-card' : 'text-ink-faint hover:text-ink'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
