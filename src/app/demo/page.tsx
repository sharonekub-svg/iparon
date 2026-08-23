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
      <header className="border-line border-b">
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
        <h1 className="text-heading text-ink mt-1.5">מערכת העיכול</h1>
        <p className="text-small text-ink-body mt-2">
          זה מה שמקבלים אחרי העלאה של שישה עמודי סיכום. אפשר להתנסות כאן בלי להירשם — כלום
          לא נשמר.
        </p>

        <DemoTabs />

        <div className="border-line mt-12 rounded-lg border px-5 py-6">
          <h2 className="text-subheading text-ink">רוצה את זה על החומר שלך?</h2>
          <p className="text-small text-ink-body mt-2">
            העלה סיכום, דף מחברת מצולם או PDF, וקבל בדיוק את זה — מהחומר שאתה צריך ללמוד.
          </p>
          <Link
            href="/signup"
            className="bg-ink text-on-ink text-label mt-5 inline-block rounded-md px-6 py-3.5"
          >
            התחל ללמוד
          </Link>
        </div>
      </main>
    </div>
  );
}
