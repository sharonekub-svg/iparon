-- LamdAI — מסלולים והרשאות
--
-- החינמי נותן טעימה אמיתית: חומר אחד מלא, עם סיכום, כרטיסיות וקוויז.
-- מה שסגור הוא ההמשך — עוד חומרים, ומבחני תרגול.
--
-- הגבולות יושבים בטבלה ולא בקוד: שינוי מכסה הוא UPDATE אחד, בלי פריסה.
-- האכיפה עצמה במסד, כי גבול שנאכף רק בממשק הוא הצעה.

create type plan_tier as enum ('free', 'premium');

create table public.plans (
  tier                  plan_tier primary key,
  -- null = בלי הגבלה
  max_study_sets_total  integer,
  max_uploads_per_month integer,
  exams_enabled         boolean not null default false,
  updated_at            timestamptz not null default now()
);

insert into public.plans (tier, max_study_sets_total, max_uploads_per_month, exams_enabled)
values
  ('free',    1,    1,  false),
  ('premium', null, 15, true);

create trigger plans_touch_updated_at
  before update on public.plans
  for each row execute function public.touch_updated_at();

-- ── שיוך המשתמש למסלול ─────────────────────────────────────────────────
-- אין ל-authenticated grant של update על העמודות האלה (ההרשאה היחידה
-- היא update(display_name)), ולכן תלמיד לא יכול לשדרג את עצמו.

alter table public.profiles
  add column plan            plan_tier   not null default 'free',
  add column plan_expires_at timestamptz;

-- ── המסלול בפועל ───────────────────────────────────────────────────────
-- premium שפג תוקפו חוזר להיות free מעצמו, בלי עבודת רקע שצריך לתחזק.

create or replace function public.effective_plan(target_user uuid)
returns public.plan_tier
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p.plan = 'premium'
     and (p.plan_expires_at is null or p.plan_expires_at > now())
    then 'premium'::public.plan_tier
    else 'free'::public.plan_tier
  end
  from public.profiles p
  where p.id = target_user;
$$;

/**
 * מה מותר למשתמש המחובר, ומה כבר ניצל. הממשק קורא את זה כדי לדעת מה
 * להציג — וזו תצוגה בלבד. האכיפה היא ב-can_create_study_set וב-start_exam.
 */
create or replace function public.my_entitlements()
returns table (
  tier              public.plan_tier,
  exams_enabled     boolean,
  sets_used         integer,
  sets_limit        integer,
  uploads_this_month integer,
  uploads_limit     integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    pl.tier,
    pl.exams_enabled,
    (select count(*)::integer from public.study_sets s where s.user_id = auth.uid()),
    pl.max_study_sets_total,
    (select count(*)::integer from public.study_sets s
      where s.user_id = auth.uid()
        and s.created_at >= date_trunc('month', now())),
    pl.max_uploads_per_month
  from public.plans pl
  where pl.tier = public.effective_plan(auth.uid());
$$;

/**
 * האם מותר לפתוח עוד חומר. מוחזרת סיבה בעברית, כדי שהמסך יציג בדיוק
 * למה נחסם — "נגמרה המכסה החודשית" ו"המסלול החינמי נגמר" הן שתי
 * הודעות שונות שמובילות לשתי פעולות שונות.
 */
create or replace function public.can_create_study_set(target_user uuid)
returns table (allowed boolean, reason text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_plan   public.plan_tier := public.effective_plan(target_user);
  v_limits record;
  v_total  integer;
  v_month  integer;
begin
  select * into v_limits from public.plans where tier = v_plan;

  select count(*) into v_total from public.study_sets where user_id = target_user;
  select count(*) into v_month from public.study_sets
   where user_id = target_user and created_at >= date_trunc('month', now());

  if v_limits.max_study_sets_total is not null
     and v_total >= v_limits.max_study_sets_total then
    return query select false,
      'במסלול החינמי אפשר חומר אחד. כדי להעלות עוד, צריך לשדרג.'::text;
    return;
  end if;

  if v_limits.max_uploads_per_month is not null
     and v_month >= v_limits.max_uploads_per_month then
    return query select false,
      'הגעת למכסה החודשית שלך. היא מתאפסת בתחילת החודש.'::text;
    return;
  end if;

  return query select true, null::text;
end;
$$;

-- ── שער המבחנים ────────────────────────────────────────────────────────
-- start_exam היא הדרך היחידה לפתוח מבחן, ולכן הבדיקה כאן היא הבדיקה.
-- חסימה בממשק בלבד הייתה נעקפת בקריאה ישירה ל-RPC.

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
    select 1 from public.plans pl
    where pl.tier = public.effective_plan(v_user) and pl.exams_enabled
  ) then
    raise exception 'מבחני תרגול פתוחים במסלול המורחב' using errcode = '42501';
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

  insert into public.attempt_answers (attempt_id, question_id, selected_index, is_correct)
  select v_attempt, p.id, null, false from picked p;

  return query
  select v_attempt, q.id, q.stem, q.options, p.pos::integer
  from picked p
  join public.questions q on q.id = p.id
  order by p.pos;
end;
$$;

-- ── הרשאות ─────────────────────────────────────────────────────────────

alter table public.plans enable row level security;

-- המסלולים עצמם ציבוריים לקריאה: המסך צריך להציג מה כלול במה.
create policy plans_readable on public.plans for select to authenticated using (true);
grant select on public.plans to authenticated;

revoke all on function public.effective_plan(uuid) from public, anon, authenticated;
revoke all on function public.can_create_study_set(uuid) from public, anon, authenticated;
revoke all on function public.my_entitlements() from public, anon;

grant execute on function public.effective_plan(uuid) to service_role;
grant execute on function public.can_create_study_set(uuid) to service_role;
grant execute on function public.my_entitlements() to authenticated;
grant execute on function public.start_exam(uuid, uuid, integer) to authenticated;
