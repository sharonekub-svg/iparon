-- ── מבחן על כמה נושאים ────────────────────────────────────────────────
--
-- קודם אפשר היה להיבחן על נושא אחד או על הכול, ולא על צירוף. אבל מבחן
-- אמיתי הוא בדיוק צירוף: "תורשה ומערכת העיכול" ולא אחד מהם. p_topic_id
-- הבודד הוחלף במערך.
--
-- null או מערך ריק = כל החומר, כמו קודם.
--
-- הפונקציה הישנה נמחקת ולא נשארת כעומס־יתר: שתי חתימות שנבדלות רק בסוג
-- הפרמטר השני יוצרות קריאה דו־משמעית כשמעבירים null.

drop function if exists public.start_exam(uuid, uuid, integer);

create or replace function public.start_exam(
  p_study_set_id uuid,
  p_topic_ids    uuid[] default null,
  p_count        integer default 10
)
returns table (
  attempt_id  uuid,
  question_id uuid,
  stem        text,
  options     jsonb,
  ordinal     integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user    uuid := (select auth.uid());
  v_attempt uuid;
  v_total   integer;
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

  -- מאגר המבחן גדל ל-60 שאלות, ומבחן על כמה נושאים סוכם אותן.
  if p_count < 1 or p_count > 100 then
    raise exception 'מספר שאלות לא תקין' using errcode = '22023';
  end if;

  -- דגימה אקראית מתוך המאגר. שני מבחנים על אותו היקף לא יהיו זהים.
  create temporary table picked on commit drop as
  select q.id, row_number() over () as pos
  from public.questions q
  where q.study_set_id = p_study_set_id
    and q.kind = 'exam'
    and (
      p_topic_ids is null
      or cardinality(p_topic_ids) = 0
      or q.topic_id = any (p_topic_ids)
    )
  order by random()
  limit p_count;

  select count(*) into v_total from picked;

  if v_total = 0 then
    raise exception 'אין שאלות מבחן להיקף הזה' using errcode = 'P0002';
  end if;

  insert into public.attempts (user_id, study_set_id, kind, question_count)
  values (v_user, p_study_set_id, 'exam', v_total)
  returning id into v_attempt;

  -- נעילת מערכת השאלות של הניסיון. is_correct מתמלא בהגשה;
  -- selected_index נשאר null כל עוד לא נענתה.
  insert into public.attempt_answers (attempt_id, question_id, selected_index, is_correct)
  select v_attempt, p.id, null, false from picked p;

  return query
  select v_attempt, q.id, q.stem, q.options, p.pos::integer
  from picked p
  join public.questions q on q.id = p.id
  order by p.pos;
end;
$$;

revoke all on function public.start_exam(uuid, uuid[], integer) from public, anon;
grant execute on function public.start_exam(uuid, uuid[], integer) to authenticated;

notify pgrst, 'reload schema';
