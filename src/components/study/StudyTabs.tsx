'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { slug: '', label: 'סיכום' },
  { slug: '/flashcards', label: 'כרטיסיות' },
  { slug: '/quiz', label: 'תרגול' },
  { slug: '/exam', label: 'מבחן' },
] as const;

export function StudyTabs({ id, examsLocked }: { id: string; examsLocked: boolean }) {
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
            aria-label={
              tab.slug === '/exam' && examsLocked
                ? `${tab.label} — במסלול המורחב`
                : undefined
            }
            aria-current={active ? 'page' : undefined}
            className={`text-label tap flex-1 rounded-full px-3.5 py-2.5 text-center ${
              active ? 'bg-surface text-ink shadow-card' : 'text-ink-faint hover:text-ink'
            }`}
          >
            {tab.label}
            {tab.slug === '/exam' && examsLocked ? (
              <span aria-hidden="true" className="text-ink-faintest ms-1">
                🔒
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
