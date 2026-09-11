-- השומר פספס את המקרה הנפוץ ביותר.
--
-- בין מנה למנה מתאפס claimed_at, כדי שההפעלה הבאה תוכל לתבוע את
-- החומר. אם ההפעלה הבאה לא הגיעה — וזה בדיוק מה שקרה בייצור — השורה
-- נשארת במצב processing עם claimed_at ריק, והתנאי הישן
-- (claimed_at is not null) דילג עליה. התלמיד נשאר מול מסך שלא יזוז.

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
     and coalesce(claimed_at, created_at) < now() - interval '4 minutes'
  returning true into v_failed;

  return coalesce(v_failed, false);
end;
$$;

revoke all on function public.fail_stuck_study_set(uuid) from public, anon;
grant execute on function public.fail_stuck_study_set(uuid) to authenticated;

-- ── חידוש עבודה שנעצרה ─────────────────────────────────────────────────
-- claimed_at ריק על חומר בעיבוד = אין עובד שמחזיק אותו. הדפדפן של
-- התלמיד, שממילא שואל כל כמה שניות מה קורה, הוא מי שמעיר את העבודה
-- מחדש. שרשרת הפעלות שרת-לשרת שבירה מדי בשביל להיות המנגנון היחיד:
-- ה-isolate נהרג לפני שהבקשה הבאה בכלל יצאה.

create or replace function public.is_study_set_stalled(p_study_set_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.study_sets
     where id = p_study_set_id
       and user_id = auth.uid()
       and status = 'processing'
       and claimed_at is null
       and created_at < now() - interval '20 seconds'
  );
$$;

revoke all on function public.is_study_set_stalled(uuid) from public, anon;
grant execute on function public.is_study_set_stalled(uuid) to authenticated;
