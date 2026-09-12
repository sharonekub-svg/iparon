-- חידוש של עיבוד שנכשל באמצע הגיע חינם.
--
-- ההחזר על כישלון מאפס את pages_charged, והחידוש מתחיל מהמנה שבה
-- נעצר — שם העובד לא קורא ל-consume_pages בכלל, כי הוא קורא לה רק
-- במנה הראשונה. כלומר חומר שנכשל במנה 3 מתוך 3 הושלם אחר כך בלי
-- לשלם. זה קרה בייצור על חומר אמיתי.
--
-- התביעה היא המקום הנכון לסגור את זה: היא רצה בכל הפעלה, והיא
-- רואה את השורה. `page_count` מלא עם `pages_charged` אפס ומנה גדולה
-- מאפס היא בדיוק החתימה של חידוש שלא שולם עליו.

create or replace function public.claim_study_set(p_study_set_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claimed boolean;
  v_set     public.study_sets;
begin
  update public.study_sets
     set claimed_at = now()
   where id = p_study_set_id
     and status <> 'ready'
     and (claimed_at is null or claimed_at < now() - interval '3 minutes')
  returning true into v_claimed;

  if not coalesce(v_claimed, false) then
    return false;
  end if;

  select * into v_set from public.study_sets where id = p_study_set_id;

  -- חידוש של עיבוד שנכשל באמצע היה מגיע חינם: ההחזר מאפס את
  -- pages_charged, והחידוש מתחיל ממנה 2 — שם העובד לא קורא ל-
  -- consume_pages בכלל (הוא קורא לה רק במנה הראשונה). page_count
  -- מלא עם pages_charged אפס הוא בדיוק החתימה של המצב הזה.
  if coalesce(v_set.page_count, 0) > 0
     and v_set.pages_charged = 0
     and v_set.chunk_index > 0 then
    begin
      perform public.consume_pages(p_study_set_id, v_set.page_count);
    exception when others then
      update public.study_sets
         set status = 'failed',
             stage  = 'failed',
             error  = 'אין מספיק עמודים ביתרה כדי להשלים את החומר.'
       where id = p_study_set_id;
      return false;
    end;
  end if;

  return true;
end;
$$;

revoke all on function public.claim_study_set(uuid) from public, anon, authenticated;
grant execute on function public.claim_study_set(uuid) to service_role;
