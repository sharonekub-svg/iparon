-- LamdAI — אכיפת המכסה בכניסה ל-study_sets
--
-- הבדיקה יושבת בטריגר ולא ב-Server Action, כי אז היא חלה על **כל**
-- מסלול יצירה: הממשק, קריאה ישירה ל-REST, או קוד עתידי ששכח לבדוק.
-- בדיקה בשכבת האפליקציה בלבד היא בדיקה שאפשר לעקוף.

create or replace function public.enforce_study_set_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_check record;
begin
  select * into v_check from public.can_create_study_set(new.user_id);

  if not v_check.allowed then
    raise exception '%', v_check.reason using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger study_sets_enforce_quota
  before insert on public.study_sets
  for each row execute function public.enforce_study_set_quota();

revoke all on function public.enforce_study_set_quota() from public, anon, authenticated;

-- גרסה שמדברת על המשתמש המחובר בלבד, לשימוש הממשק.
create or replace function public.my_upload_allowance()
returns table (allowed boolean, reason text)
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.can_create_study_set(auth.uid());
$$;

revoke all on function public.my_upload_allowance() from public, anon;
grant execute on function public.my_upload_allowance() to authenticated;
