import Link from 'next/link';

import { DemoTabs } from './DemoTabs';

import { brand } from '@/lib/brand';

export const metadata = {
  title: 'דמו',
  description: 'ככה נראה חומר אחרי עיבוד — סיכום, כרטיסיות ותרגול. בלי הרשמה.',
};

export default function DemoPage() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-line bg-paper/80 sticky top-0 z-10 border-b backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link href="/" className="text-meta text-ink font-mono">
            {brand.name}
          </Link>
          <Link
            href="/signup"
            className="text-label text-ink-muted hover:text-ink transition-colors"
          >
            הרשמה
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8">
        <p className="text-meta text-ink-faint">דמו</p>
        <h1 className="text-display text-ink mt-1.5">מערכת העיכול</h1>
        <p className="text-small text-ink-body mt-2">
          זה מה שמקבלים אחרי העלאה של שישה עמודי סיכום. אפשר להתנסות כאן בלי להירשם — כלום
          לא נשמר.
        </p>

        <DemoTabs />

        <div className="border-line-strong bg-surface shadow-card mt-12 rounded-2xl border px-6 py-10 text-center">
          <h2 className="text-heading text-ink text-balance">רוצה את זה על החומר שלך?</h2>
          <p className="text-small text-ink-body mx-auto mt-3 max-w-sm text-pretty">
            העלה סיכום, דף מחברת מצולם או PDF, וקבל בדיוק את זה — מהחומר שאתה צריך ללמוד.
          </p>
          <Link
            href="/signup"
            className="bg-ink text-on-ink text-label tap mt-7 inline-block rounded-lg px-7 py-4 hover:opacity-90"
          >
            התחל ללמוד
          </Link>
        </div>
      </main>
    </div>
  );
}
