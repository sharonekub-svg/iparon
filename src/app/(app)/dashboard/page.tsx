import Link from 'next/link';

import { IconAddPage } from '@/components/ui/IconAddPage';
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
        <Link href="/premium" className="text-meta text-ink-faint hover:text-ink">
          {entitlements.freeUsed ? (
            <>
              <span className="num">{entitlements.credits}</span> יחידות
            </>
          ) : (
            'החבילות'
          )}
        </Link>
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
            className="border-line-strong bg-surface shadow-card hover:shadow-lift tap mt-6 flex items-center gap-4 rounded-2xl border px-5 py-5"
          >
            <IconAddPage className="text-ink shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="text-subheading text-ink block">העלה חומר חדש</span>
              <span className="text-meta text-ink-faint mt-0.5 block">
                צילום מהמחברת או PDF
              </span>
            </span>
            <IconArrow direction="forward" className="text-ink-faintest" />
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
                    className="border-line-strong bg-surface shadow-card hover:shadow-lift tap flex items-center gap-3 rounded-2xl border px-5 py-5"
                  >
                    <div className="min-w-0 flex-1">
                      {set.subject ? (
                        <span className="text-meta text-ink-faint block">
                          {set.subject}
                        </span>
                      ) : null}

                      <div className="mt-0.5 flex items-baseline justify-between gap-3">
                        <span className="text-subheading text-ink truncate">
                          {set.title}
                        </span>
                        {set.mastery !== null ? (
                          <span className="num text-heading text-ink shrink-0">
                            {set.mastery}%
                          </span>
                        ) : null}
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

                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        {ready ? (
                          <>
                            <span className="bg-surface-sunk text-meta text-ink-body rounded-full px-2.5 py-1">
                              <span className="num">{set.flashcardCount}</span> כרטיסיות
                            </span>
                            <span className="bg-surface-sunk text-meta text-ink-body rounded-full px-2.5 py-1">
                              <span className="num">{set.quizCount}</span> שאלות
                            </span>
                          </>
                        ) : (
                          <span
                            className={`text-meta rounded-full px-2.5 py-1 ${
                              set.status === 'failed'
                                ? 'bg-wrong-soft text-wrong'
                                : 'bg-surface-sunk text-ink-body'
                            }`}
                          >
                            {statusLabels[set.status]}
                            {set.status === 'processing' || set.status === 'queued'
                              ? '…'
                              : ''}
                          </span>
                        )}
                      </div>
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
