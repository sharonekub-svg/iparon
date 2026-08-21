-- LamdAI — מבחן תרגול
--
-- שתי פונקציות security definer. הן הדרך היחידה לפתוח מבחן ולסגור אותו,
-- ולכן:
--   * התלמיד לא יכול להמציא ניסיון או לכתוב לעצמו ציון — ל-attempts
--     אין policy של insert או update, וגם לא grant.
--   * התשובות הנכונות לא נשלחות ללקוח בזמן המבחן: start_exam מחזירה
--     את השאלות בלי correct_index, והחישוב נעשה כאן מול העמודה.
--   * אין צורך במפתח service role בשום מקום בקוד האתר.
--
-- הבעלות נבדקת בתוך הפונקציה מול auth.uid(), כי security definer עוקף
-- RLS — פונקציה כזאת בלי בדיקת בעלות היא דלת אחורית לכל הנתונים.

-- ── פתיחת מבחן ─────────────────────────────────────────────────────────
-- p_topic_id ריק = מבחן משותף על כל החומר.

create or replace function public.start_exam(
  p_study_set_id uuid,
  p_topic_id     uuid default null,
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

  if p_count < 1 or p_count > 50 then
    raise exception 'מספר שאלות לא תקין' using errcode = '22023';
  end if;

  -- דגימה אקראית מתוך המאגר. שני מבחנים על אותו נושא לא יהיו זהים.
  create temporary table picked on commit drop as
  select q.id, row_number() over () as pos
  from public.questions q
  where q.study_set_id = p_study_set_id
    and q.kind = 'exam'
    and (p_topic_id is null or q.topic_id = p_topic_id)
  order by random()
  limit p_count;

  select count(*) into v_total from picked;

  if v_total = 0 then
    raise exception 'אין שאלות מבחן לנושא הזה' using errcode = 'P0002';
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

-- ── הגשת מבחן ──────────────────────────────────────────────────────────
-- p_answers: [{"question_id":"...","selected_index":0}, ...]
-- שאלה שלא נענתה פשוט לא מופיעה במערך, ונשארת שגויה.

create or replace function public.submit_exam(
  p_attempt_id uuid,
  p_answers    jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user  uuid := (select auth.uid());
  v_score integer;
  v_total integer;
begin
  if v_user is null then
    raise exception 'לא מחובר' using errcode = '28000';
  end if;

  -- גם בעלות וגם "עוד לא הוגש": הגשה חוזרת לא תשנה ציון קיים.
  if not exists (
    select 1 from public.attempts a
    where a.id = p_attempt_id
      and a.user_id = v_user
      and a.finished_at is null
  ) then
    raise exception 'הניסיון לא נמצא או שכבר הוגש' using errcode = '42501';
  end if;

  -- הנכונות נקבעת כאן, מול correct_index. מה שהלקוח שלח הוא הבחירה
  -- בלבד — הוא לא מדווח אם צדק.
  update public.attempt_answers aa
  set selected_index = (ans.value ->> 'selected_index')::smallint,
      is_correct = (
        (ans.value ->> 'selected_index')::smallint
        = (select q.correct_index from public.questions q where q.id = aa.question_id)
      )
  from jsonb_array_elements(p_answers) as ans
  where aa.attempt_id = p_attempt_id
    and aa.question_id = (ans.value ->> 'question_id')::uuid;

  select count(*) filter (where is_correct), count(*)
  into v_score, v_total
  from public.attempt_answers
  where attempt_id = p_attempt_id;

  v_score := round(100.0 * v_score / nullif(v_total, 0));

  update public.attempts
  set score = v_score, finished_at = now()
  where id = p_attempt_id;

  return v_score;
end;
$$;

revoke all on function public.start_exam(uuid, uuid, integer) from public, anon;
revoke all on function public.submit_exam(uuid, jsonb) from public, anon;
grant execute on function public.start_exam(uuid, uuid, integer) to authenticated;
grant execute on function public.submit_exam(uuid, jsonb) to authenticated;
