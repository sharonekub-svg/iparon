-- שינון — סכימה ראשונית
--
-- אין התחברות בגרסה הזאת, ולכן אין משתמשים. כל חומר משויך ל-device_id
-- אנונימי שנוצר במכשיר. ה-device_id לא סוד, ולכן RLS חוסמת את הטבלאות
-- לחלוטין מול המפתח הציבורי: האפליקציה לא נוגעת בטבלאות ישירות, אלא רק
-- דרך ה-Edge Functions, שרצות עם service role.
--
-- כשתתווסף התחברות, ה-device_id יוחלף ב-auth.uid() ואפשר יהיה לפתוח
-- מדיניות RLS אמיתית לקריאה ישירה מהאפליקציה.

create extension if not exists "pgcrypto";

-- ── חומרים ─────────────────────────────────────────────────────────────

create type material_status as enum ('processing', 'ready', 'failed');
create type material_source as enum ('pdf', 'camera');

create table materials (
  id           uuid primary key default gen_random_uuid(),
  device_id    text not null,
  title        text not null,
  source       material_source not null,
  status       material_status not null default 'processing',
  page_count   integer not null default 0 check (page_count >= 0),
  -- התוצאה מהמודל, במבנה של src/types/study.ts
  study_set    jsonb,
  -- הודעת שגיאה בעברית, כשה-status הוא failed
  error        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- חומר מוכן חייב תוצאה, וחומר שנכשל חייב סיבה
  constraint ready_has_study_set check (status <> 'ready' or study_set is not null),
  constraint failed_has_error check (status <> 'failed' or error is not null)
);

create index materials_device_created_idx on materials (device_id, created_at desc);

-- ── ספירת קריאות למודל ─────────────────────────────────────────────────
-- כלל ברזל 7: כל קריאה נרשמת, כולל קריאות שנכשלו, כדי שהתקרה
-- החודשית תשקף את ההוצאה האמיתית ולא רק את ההצלחות.

create table model_calls (
  id                 uuid primary key default gen_random_uuid(),
  material_id        uuid references materials (id) on delete set null,
  model              text not null,
  input_tokens       integer not null default 0,
  output_tokens      integer not null default 0,
  cache_read_tokens  integer not null default 0,
  cost_usd           numeric(10, 6) not null default 0,
  ok                 boolean not null,
  error              text,
  created_at         timestamptz not null default now()
);

create index model_calls_created_idx on model_calls (created_at desc);

-- ── תקרה חודשית ────────────────────────────────────────────────────────
-- שורה אחת. משנים אותה ב-SQL בלי לפרוס מחדש את הפונקציה.

create table usage_caps (
  id                     boolean primary key default true check (id),
  max_calls_per_month    integer not null check (max_calls_per_month >= 0),
  max_cost_usd_per_month numeric(10, 2) not null check (max_cost_usd_per_month >= 0),
  updated_at             timestamptz not null default now()
);

insert into usage_caps (max_calls_per_month, max_cost_usd_per_month)
values (500, 25.00);

-- השימוש מתחילת החודש הקלנדרי, לפי UTC
create or replace function month_usage()
returns table (calls integer, cost_usd numeric)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*)::integer as calls,
    coalesce(sum(cost_usd), 0)::numeric as cost_usd
  from model_calls
  where created_at >= date_trunc('month', now());
$$;

-- ── RLS: חסימה מלאה מול המפתח הציבורי ──────────────────────────────────
-- אין policies בכוונה. service role עוקף RLS, ולכן ה-Edge Functions
-- עובדות, והאפליקציה — שמחזיקה רק את מפתח ה-anon — לא יכולה לקרוא כלום.

alter table materials enable row level security;
alter table model_calls enable row level security;
alter table usage_caps enable row level security;

revoke all on function month_usage() from anon, authenticated;

-- ── updated_at ─────────────────────────────────────────────────────────

create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger materials_touch_updated_at
  before update on materials
  for each row
  execute function touch_updated_at();
