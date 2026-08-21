'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { slug: '', label: 'סיכום' },
  { slug: '/flashcards', label: 'כרטיסיות' },
  { slug: '/quiz', label: 'תרגול' },
  { slug: '/exam', label: 'מבחן' },
] as const;

export function StudyTabs({ id }: { id: string }) {
  const pathname = usePathname();
  const base = `/sets/${id}`;

  return (
    <nav className="border-line mt-6 flex gap-1 border-b" aria-label="חלקי החומר">
      {tabs.map((tab) => {
        const href = `${base}${tab.slug}`;
        const active = pathname === href;

        return (
          <Link
            key={tab.slug}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`text-label -mb-px border-b-2 px-3.5 py-2.5 transition-colors ${
              active
                ? 'border-ink text-ink'
                : 'text-ink-faint hover:text-ink border-transparent'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
