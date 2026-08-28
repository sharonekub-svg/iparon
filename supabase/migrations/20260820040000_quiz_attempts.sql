-- LamdAI — שמירת ניסיון קוויז
--
-- הקוויז היה state בדפדפן בלבד, ולכן אף תשובה לא הגיעה למסד. המשמעות:
-- topic_mastery ראה רק תשובות ממבחנים, ומשתמש חינמי — שאין לו מבחנים —
-- קיבל שליטה שמבוססת על כרטיסיות בלבד. הנוסחה שהובטחה לא התקיימה.
--
-- כמו במבחן: הלקוח שולח רק את הבחירות, והנכונות נקבעת כאן מול
-- correct_index. הוא לא מדווח אם צדק.

create or replace function public.record_quiz_attempt(
  p_study_set_id uuid,
  p_answers      jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user    uuid := (select auth.uid());
  v_attempt uuid;
  v_total   integer;
  v_correct integer;
begin
  if v_user is null then
    raise exception 'לא מחובר' using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.study_sets s
    where s.id = p_study_set_id and s.user_id = v_user
  ) then
    raise exception 'החומר לא נמצא' using errcode = '42501';
  end if;

  -- רק שאלות קוויז של החומר הזה. מזהה שהתגנב מחומר אחר לא נספר.
  create temporary table answered on commit drop as
  select
    q.id as question_id,
    (a.value ->> 'selected_index')::smallint as selected_index,
    ((a.value ->> 'selected_index')::smallint = q.correct_index) as is_correct
  from jsonb_array_elements(p_answers) as a
  join public.questions q
    on q.id = (a.value ->> 'question_id')::uuid
   and q.study_set_id = p_study_set_id
   and q.kind = 'quiz';

  select count(*) into v_total from answered;

  if v_total = 0 then
    raise exception 'לא התקבלו תשובות' using errcode = '22023';
  end if;

  select count(*) filter (where is_correct) into v_correct from answered;

  insert into public.attempts
    (user_id, study_set_id, kind, question_count, score, finished_at)
  values
    (v_user, p_study_set_id, 'quiz', v_total,
     round(100.0 * v_correct / v_total), now())
  returning id into v_attempt;

  insert into public.attempt_answers (attempt_id, question_id, selected_index, is_correct)
  select v_attempt, question_id, selected_index, is_correct from answered;

  return round(100.0 * v_correct / v_total);
end;
$$;

revoke all on function public.record_quiz_attempt(uuid, jsonb) from public, anon;
grant execute on function public.record_quiz_attempt(uuid, jsonb) to authenticated;
