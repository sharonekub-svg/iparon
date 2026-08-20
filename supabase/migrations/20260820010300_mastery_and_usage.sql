-- LamdAI — מאסטרי ושימוש
--
-- מאסטרי הוא VIEW ולא טבלה (PLAN.md סעיף 4.3). טבלה מחושבת חייבת
-- סנכרון, וסנכרון נשבר. VIEW לא יכול להיות לא מסונכרן. אם יזדחל —
-- materialized view עם רענון, וזו החלפה מקומית.
--
-- security_invoker = on הוא קריטי: בלעדיו ה-VIEW רץ בהרשאות היוצר
-- ועוקף את ה-RLS של הטבלאות שמתחתיו, כלומר תלמיד היה רואה את
-- המאסטרי של כולם.

create view public.topic_mastery
with (security_invoker = on)
as
with question_stats as (
  select
    a.user_id,
    q.study_set_id,
    q.topic_id,
    (count(*) filter (where aa.is_correct))::numeric / count(*) as accuracy,
    count(*) as answered
  from public.attempt_answers aa
  join public.attempts a on a.id = aa.attempt_id
  join public.questions q on q.id = aa.question_id
  where q.topic_id is not null
  group by a.user_id, q.study_set_id, q.topic_id
),
card_stats as (
  -- דירוג 0/1/2 מנורמל ל-0..1
  select
    r.user_id,
    f.study_set_id,
    f.topic_id,
    avg(r.rating)::numeric / 2 as recall,
    count(*) as reviewed
  from public.flashcard_reviews r
  join public.flashcards f on f.id = r.flashcard_id
  where f.topic_id is not null
  group by r.user_id, f.study_set_id, f.topic_id
)
select
  coalesce(q.user_id, c.user_id)           as user_id,
  coalesce(q.study_set_id, c.study_set_id) as study_set_id,
  coalesce(q.topic_id, c.topic_id)         as topic_id,
  coalesce(q.answered, 0)                  as questions_answered,
  coalesce(c.reviewed, 0)                  as cards_reviewed,
  round(100 * case
    -- יש נתונים משני הצדדים: 60% שאלות, 40% כרטיסיות
    when q.accuracy is not null and c.recall is not null
      then 0.6 * q.accuracy + 0.4 * c.recall
    -- אחרת מה שיש
    when q.accuracy is not null then q.accuracy
    else c.recall
  end)::smallint as mastery
from question_stats q
full outer join card_stats c
  on  c.user_id      = q.user_id
  and c.study_set_id = q.study_set_id
  and c.topic_id     = q.topic_id;

grant select on public.topic_mastery to authenticated;

-- ── שימוש חודשי ────────────────────────────────────────────────────────
-- נקראת מהעובד לפני כל קריאה למודל. security definer כדי שתוכל לקרוא
-- את model_calls, שחסומה מול כל תפקיד ציבורי — ולכן ההרשאה עליה
-- ניתנת ל-service_role בלבד.

create or replace function public.month_usage()
returns table (calls integer, cost_usd numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select
    count(*)::integer                    as calls,
    coalesce(sum(cost_usd), 0)::numeric  as cost_usd
  from public.model_calls
  where created_at >= date_trunc('month', now());
$$;

revoke all on function public.month_usage() from public, anon, authenticated;
grant execute on function public.month_usage() to service_role;

-- כמה העלאות המשתמש הזה עשה החודש. אותו נימוק.
create or replace function public.user_uploads_this_month(target_user uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.study_sets
  where user_id = target_user
    and created_at >= date_trunc('month', now());
$$;

revoke all on function public.user_uploads_this_month(uuid) from public, anon, authenticated;
grant execute on function public.user_uploads_this_month(uuid) to service_role;
