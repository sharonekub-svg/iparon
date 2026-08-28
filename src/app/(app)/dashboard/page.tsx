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
        <h1 className="text-display text-ink">{greeting}</h1>
        {entitlements.tier === 'free' ? (
          <Link href="/premium" className="text-meta text-ink-faint hover:text-ink">
            שדרוג
          </Link>
        ) : null}
      </div>

      {sets.length === 0 ? (
        <section className="mt-8">
          <div className="rise border-line-strong bg-surface shadow-card rounded-2xl border px-5 py-12 text-center">
            <p className="text-heading text-ink text-balance">בוא נתחיל</p>
            <p className="text-small text-ink-body mx-auto mt-3 max-w-xs text-pretty">
              צלם דף מהמחברת או העלה PDF. תוך כמה רגעים יחכו לך סיכום, כרטיסיות ושאלות
              מהחומר שלך.
            </p>
            <Link
              href="/upload"
              className="bg-ink text-on-ink text-label tap mt-7 inline-block rounded-lg px-7 py-4 hover:opacity-90"
            >
              העלה חומר ראשון
            </Link>
          </div>
        </section>
      ) : (
        <>
          <Link
            href="/upload"
            className="border-line-dashed text-label text-ink hover:bg-surface hover:border-ink tap mt-6 flex items-center justify-center gap-2 rounded-2xl border border-dashed px-5 py-6"
          >
            <span
              aria-hidden="true"
              className="border-line-strong flex size-6 items-center justify-center rounded-full border text-base leading-none"
            >
              +
            </span>
            העלה חומר חדש
          </Link>

          <h2 className="text-subheading text-ink mt-10">החומרים שלי</h2>

          <ul className="mt-3 flex flex-col gap-2.5">
            {sets.map((set) => {
              const ready = set.status === 'ready';
              const href = ready ? `/sets/${set.id}` : `/sets/${set.id}/processing`;

              return (
                <li key={set.id}>
                  <Link
                    href={href}
                    className="border-line-strong bg-surface shadow-card hover:shadow-lift tap flex items-center gap-3 rounded-2xl border px-4 py-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-subheading text-ink truncate">
                          {set.title}
                        </span>
                        {set.mastery !== null ? (
                          <span className="num text-subheading text-ink shrink-0">
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
                        <div className="bg-track mt-3 h-1.5 overflow-hidden rounded-full">
                          <div
                            className="bg-ink h-full rounded-full"
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
