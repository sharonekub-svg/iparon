import Link from 'next/link';

import { createServerSupabase } from '@/lib/supabase/server';
import { getEntitlements } from '@/lib/plans';
import { listStudySets, statusLabels } from '@/lib/study';

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

      <Link
        href="/upload"
        className="border-line-dashed text-label text-ink hover:bg-surface-sunk mt-6 flex items-center justify-center rounded-lg border border-dashed px-5 py-5 transition-colors"
      >
        העלה חומר חדש
      </Link>

      <h2 className="text-subheading text-ink mt-10">החומרים שלי</h2>

      {sets.length === 0 ? (
        <div className="border-line mt-4 rounded-lg border px-5 py-8">
          <p className="text-small text-ink-body">
            עוד לא העלית כלום. תעלה סיכום, דף מחברת מצולם או PDF, ותוך כמה רגעים יהיו לך
            סיכום, כרטיסיות ושאלות.
          </p>
        </div>
      ) : (
        <ul className="mt-4 flex flex-col">
          {sets.map((set) => {
            const ready = set.status === 'ready';
            const href = ready ? `/sets/${set.id}` : `/sets/${set.id}/processing`;

            return (
              <li key={set.id} className="border-line border-b last:border-b-0">
                <Link
                  href={href}
                  className="hover:bg-surface-sunk -mx-3 flex flex-col gap-1.5 rounded-md px-3 py-4 transition-colors"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-bodyStrong text-ink font-semibold">
                      {set.title}
                    </span>
                    {set.mastery !== null ? (
                      <span className="text-meta text-ink-faint font-mono">
                        <span className="num">{set.mastery}</span>%
                      </span>
                    ) : null}
                  </div>

                  <div className="text-meta text-ink-faint flex flex-wrap items-center gap-x-3 gap-y-1">
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
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
