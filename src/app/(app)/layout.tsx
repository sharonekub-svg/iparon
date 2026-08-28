import Link from 'next/link';
import { redirect } from 'next/navigation';

import { signOut } from '../(auth)/actions';

import { brand } from '@/lib/brand';
import { createServerSupabase } from '@/lib/supabase/server';

/**
 * המעטפת של האזור המוגן.
 *
 * proxy.ts כבר חוסם את המסלולים האלה, אבל הבדיקה חוזרת כאן בכוונה:
 * הגנה שנשענת על שכבה אחת בלבד נשברת ברגע שמישהו משנה matcher.
 */
export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-line bg-paper/80 sticky top-0 z-10 border-b backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-2.5">
          <Link
            href="/dashboard"
            className="text-meta text-ink tap -ms-3 flex min-h-11 items-center rounded-lg px-3 font-mono"
          >
            {brand.name}
          </Link>
          <form action={signOut} className="-me-3">
            <button
              type="submit"
              className="text-label text-ink-muted hover:text-ink tap flex min-h-11 items-center rounded-lg px-3"
            >
              יציאה
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8">{children}</main>
    </div>
  );
}
