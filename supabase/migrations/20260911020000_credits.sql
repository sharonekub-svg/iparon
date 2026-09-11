-- LamdAI — מעבר ממנוי חודשי ליחידות העלאה
--
-- למה: העלות שלנו היא לכל העלאה, והשימוש של תלמיד הוא התפרצות לפני
-- מבחן ואחר כך שבועיים של כלום. מנוי חודשי גובה בשבועות השקטים
-- (ואז מבוטל) וחוסם בדיוק בשבוע העמוס. יחידות מתנהגות כמו העלות.
--
-- שלושה עקרונות:
--   1. ההעלאה הראשונה חינם, לתמיד. אחריה צריך יחידות.
--   2. יחידה נגרעת באותה טרנזקציה שבה נוצר החומר, ולא בשכבת האפליקציה.
--   3. עיבוד שנכשל מחזיר את היחידה. תלמיד לא משלם על כשל שלנו.

alter table public.profiles
  add column upload_credits integer not null default 0
    check (upload_credits >= 0);

-- מסמן האם נגרעה יחידה על החומר הזה. בלי זה אי אפשר לדעת אם מגיע
-- החזר כשעיבוד נכשל — ההעלאה הראשונה למשל לא חויבה מלכתחילה.
alter table public.study_sets
  add column credit_charged  boolean not null default false,
  add column credit_refunded boolean not null default false;

-- ── החבילות ────────────────────────────────────────────────────────────
-- בטבלה ולא בקוד: שינוי מחיר או כמות הוא UPDATE, בלי פריסה.

create table public.credit_packs (
  slug          text primary key,
  title         text not null,
  uploads       integer not null check (uploads > 0),
  price_agorot  integer not null check (price_agorot > 0),
  sort          integer not null default 0,
  active        boolean not null default true
);

insert into public.credit_packs (slug, title, uploads, price_agorot, sort) values
  ('exam',    'מבחן אחד',  5,  2900, 1),
  ('term',    'מחצית',    15,  6900, 2),
  ('bagrut',  'בגרות',    40, 14900, 3);

alter table public.credit_packs enable row level security;

-- המחירים מוצגים באתר, ולכן קריאה פתוחה. כתיבה היא של service role.
create policy credit_packs_read on public.credit_packs
  for select to anon, authenticated using (active);

-- ── יומן היחידות ───────────────────────────────────────────────────────
-- לא הכרחי לתפעול, הכרחי לתשובה לשאלה "למה נגמרו לי היחידות".

create table public.credit_events (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  delta        integer not null,
  reason       text not null,
  study_set_id uuid references public.study_sets (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index credit_events_user_idx on public.credit_events (user_id, created_at desc);

alter table public.credit_events enable row level security;

create policy credit_events_select_own on public.credit_events
  for select to authenticated using (user_id = auth.uid());

-- ── זיכוי ──────────────────────────────────────────────────────────────

create or replace function public.grant_credits(
  target_user uuid,
  p_uploads   integer,
  p_reason    text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance integer;
begin
  if p_uploads is null or p_uploads < 1 or p_uploads > 500 then
    raise exception 'כמות יחידות לא תקינה: %', p_uploads;
  end if;

  update public.profiles
     set upload_credits = upload_credits + p_uploads
   where id = target_user
  returning upload_credits into v_balance;

  if v_balance is null then
    raise exception 'לא נמצא פרופיל למשתמש %', target_user;
  end if;

  insert into public.credit_events (user_id, delta, reason)
  values (target_user, p_uploads, p_reason);

  return v_balance;
end;
$$;

revoke all on function public.grant_credits(uuid, integer, text)
  from public, anon, authenticated;
grant execute on function public.grant_credits(uuid, integer, text) to service_role;

-- ── מי רשאי להעלות ─────────────────────────────────────────────────────

create or replace function public.can_create_study_set(target_user uuid)
returns table (allowed boolean, reason text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_total   integer;
  v_credits integer;
begin
  select count(*) into v_total from public.study_sets where user_id = target_user;

  -- הראשון חינם. זה הרגע שבו התלמיד מבין מה הוא קונה.
  if v_total = 0 then
    return query select true, null::text;
    return;
  end if;

  select upload_credits into v_credits from public.profiles where id = target_user;

  if coalesce(v_credits, 0) > 0 then
    return query select true, null::text;
    return;
  end if;

  return query select false,
    'נגמרו לך יחידות ההעלאה. אפשר להוסיף עוד.'::text;
end;
$$;

revoke all on function public.can_create_study_set(uuid) from public, anon, authenticated;
grant execute on function public.can_create_study_set(uuid) to service_role;

-- ── גריעה, באותה טרנזקציה של יצירת החומר ───────────────────────────────
-- בדיקה ואז גריעה בשתי פקודות נפרדות היא מרוץ: שתי העלאות במקביל
-- היו עוברות שתיהן על יחידה אחת. ה-update עם התנאי על היתרה הוא
-- הבדיקה והגריעה גם יחד.

create or replace function public.enforce_study_set_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total   integer;
  v_balance integer;
begin
  select count(*) into v_total from public.study_sets where user_id = new.user_id;

  if v_total = 0 then
    new.credit_charged := false;
    return new;
  end if;

  update public.profiles
     set upload_credits = upload_credits - 1
   where id = new.user_id
     and upload_credits > 0
  returning upload_credits into v_balance;

  if v_balance is null then
    raise exception 'נגמרו לך יחידות ההעלאה. אפשר להוסיף עוד.'
      using errcode = '42501';
  end if;

  new.credit_charged := true;

  insert into public.credit_events (user_id, delta, reason, study_set_id)
  values (new.user_id, -1, 'upload', new.id);

  return new;
end;
$$;

-- ── החזר על עיבוד שנכשל ────────────────────────────────────────────────

create or replace function public.refund_failed_study_set()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'error'
     and old.status is distinct from 'error'
     and new.credit_charged
     and not new.credit_refunded then

    update public.profiles
       set upload_credits = upload_credits + 1
     where id = new.user_id;

    insert into public.credit_events (user_id, delta, reason, study_set_id)
    values (new.user_id, 1, 'refund:error', new.id);

    new.credit_refunded := true;
  end if;

  return new;
end;
$$;

create trigger study_sets_refund_on_error
  before update on public.study_sets
  for each row execute function public.refund_failed_study_set();

revoke all on function public.refund_failed_study_set() from public, anon, authenticated;

-- ── מה מוצג בממשק ──────────────────────────────────────────────────────
-- המבחן נפתח לכולם: השאלות כבר נוצרו בעיבוד היחיד, ופתיחת מבחן היא
-- קריאת DB בלבד. לנעול אותה מאחורי תשלום זה לגבות פעמיים על אותו
-- חומר שכבר שולם עליו.

drop function if exists public.my_entitlements();

create or replace function public.my_entitlements()
returns table (
  credits    integer,
  sets_used  integer,
  free_used  boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(p.upload_credits, 0),
    (select count(*)::integer from public.study_sets s where s.user_id = auth.uid()),
    (select count(*) from public.study_sets s where s.user_id = auth.uid()) > 0
  from public.profiles p
  where p.id = auth.uid();
$$;

revoke all on function public.my_entitlements() from public, anon;
grant execute on function public.my_entitlements() to authenticated;

-- התקרה האישית ב-usage_caps היא מעכשיו בלם נגד שימוש חריג בלבד, ולא
-- מכסת מוצר — מי שקנה 40 יחידות רשאי להשתמש בהן.
update public.usage_caps set max_uploads_per_user_per_month = 60 where id;
