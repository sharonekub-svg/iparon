import { createServerSupabase } from '@/lib/supabase/server';

export const metadata = { title: 'החומרים שלי' };

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

  const greeting = profile?.display_name ? `שלום ${profile.display_name}` : 'שלום';

  return (
    <>
      <h1 className="text-heading text-ink">{greeting} 👋</h1>

      {/* שלב 5 ממלא כאן את רשימת החומרים ואת ההתקדמות */}
      <p className="text-small text-ink-muted mt-6">כאן יופיעו החומרים שלך.</p>
    </>
  );
}
