-- שומר על חומר שנתקע.
--
-- Edge Function נהרגת אחרי ~150 שניות. אם הקריאה למודל ארוכה מזה,
-- העובד מת באמצע ואף אחד לא מסמן את החומר ככושל: התלמיד נשאר מול
-- מסך "מנתח את החומר" לנצח, והעמודים שנגבו ממנו לא חוזרים.
--
-- אין כאן מתזמן. הפונקציה נקראת ממסך העיבוד עצמו, שממילא שואל כל
-- כמה שניות מה קורה — מי שממתין הוא גם מי שמגלה שהעבודה מתה.

create or replace function public.fail_stuck_study_set(p_study_set_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_failed boolean;
begin
  update public.study_sets
     set status = 'failed',
         stage  = 'failed',
         error  = 'העיבוד נעצר באמצע. העמודים הוחזרו ליתרה — אפשר לנסות שוב.'
   where id = p_study_set_id
     and user_id = auth.uid()
     and status = 'processing'
     and claimed_at is not null
     and claimed_at < now() - interval '4 minutes'
  returning true into v_failed;

  -- ההחזר עצמו קורה בטריגר study_sets_refund_on_error.
  return coalesce(v_failed, false);
end;
$$;

revoke all on function public.fail_stuck_study_set(uuid) from public, anon;
grant execute on function public.fail_stuck_study_set(uuid) to authenticated;
