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
      <header className="border-line border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link href="/dashboard" className="text-meta text-ink font-mono">
            {brand.name}
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="text-label text-ink-muted hover:text-ink transition-colors"
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
