import Link from 'next/link';

import { IconArrow } from '@/components/ui/IconArrow';
import { getEntitlements } from '@/lib/plans';
import { listStudySets, statusLabels } from '@/lib/study';
import { createServerSupabase } from '@/lib/supabase/server';

export const metadata = { title: 'החומרים שלי' };

// המצב מתעדכן בזמן עיבוד, ולכן אין טעם להגיש גרסה שמורה
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user!.id)
    .maybeSingle();

  const [sets, entitlements] = await Promise.all([listStudySets(), getEntitlements()]);
  const greeting = profile?.display_name ? `שלום ${profile.display_name}` : 'שלום';

  return (
    <>
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-heading text-ink">{greeting} 👋</h1>
        {entitlements.tier === 'free' ? (
          <Link href="/premium" className="text-meta text-ink-faint hover:text-ink">
            שדרוג
          </Link>
        ) : null}
      </div>

      {sets.length === 0 ? (
        <section className="mt-8">
          <div className="border-line-dashed rounded-xl border border-dashed px-5 py-10 text-center">
            <p className="text-subheading text-ink">בוא נתחיל</p>
            <p className="text-small text-ink-body mx-auto mt-2 max-w-xs">
              צלם דף מהמחברת או העלה PDF. תוך כמה רגעים יחכו לך סיכום, כרטיסיות ושאלות
              מהחומר שלך.
            </p>
            <Link
              href="/upload"
              className="bg-ink text-on-ink text-label mt-6 inline-block rounded-md px-6 py-3.5"
            >
              העלה חומר ראשון
            </Link>
          </div>
        </section>
      ) : (
        <>
          <Link
            href="/upload"
            className="border-line-dashed text-label text-ink hover:bg-surface-sunk mt-6 flex items-center justify-center rounded-lg border border-dashed px-5 py-5 transition-colors"
          >
            העלה חומר חדש
          </Link>

          <h2 className="text-subheading text-ink mt-10">החומרים שלי</h2>

          <ul className="mt-3 flex flex-col">
            {sets.map((set) => {
              const ready = set.status === 'ready';
              const href = ready ? `/sets/${set.id}` : `/sets/${set.id}/processing`;

              return (
                <li key={set.id} className="border-line border-b last:border-b-0">
                  <Link
                    href={href}
                    className="hover:bg-surface-sunk -mx-3 flex items-center gap-3 rounded-md px-3 py-4 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-bodyStrong text-ink truncate font-semibold">
                          {set.title}
                        </span>
                        {set.mastery !== null ? (
                          <span className="num text-meta text-ink-faint shrink-0 font-mono">
                            {set.mastery}%
                          </span>
                        ) : null}
                      </div>

                      <div className="text-meta text-ink-faint mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                        {set.subject ? <span>{set.subject}</span> : null}
                        {ready ? (
                          <>
                            <span>
                              <span className="num">{set.flashcardCount}</span> כרטיסיות
                            </span>
                            <span>
                              <span className="num">{set.quizCount}</span> שאלות
                            </span>
                          </>
                        ) : (
                          <span className={set.status === 'failed' ? 'text-wrong' : ''}>
                            {statusLabels[set.status]}
                            {set.status === 'processing' || set.status === 'queued'
                              ? '…'
                              : ''}
                          </span>
                        )}
                      </div>

                      {/* שליטה כפס ולא רק כמספר — נקרא במבט אחד בזמן גלילה */}
                      {set.mastery !== null ? (
                        <div className="bg-track mt-2.5 h-1 overflow-hidden rounded-full">
                          <div
                            className="bg-ink h-full"
                            style={{ width: `${set.mastery}%` }}
                          />
                        </div>
                      ) : null}
                    </div>

                    <IconArrow direction="forward" className="text-ink-faintest" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
