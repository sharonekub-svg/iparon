-- LamdAI — הסכימה הראשונית
--
-- המבנה מתועד ב-docs/PLAN.md סעיף 4. שתי החלטות שחוסכות טבלאות:
-- questions אחת במקום quiz_questions + exam_questions, ו-attempts אחת
-- במקום quiz_attempts + exam_attempts. המבנה זהה, ו-kind מבדיל.
--
-- RLS וההרשאות נכנסים בהגירה שאחרי זו. הקובץ הזה הוא מבנה בלבד.

create extension if not exists "pgcrypto";

-- ── טיפוסים ────────────────────────────────────────────────────────────

-- status = מה מצב החומר. stage = איפה העובד נמצא עכשיו, למסך העיבוד.
create type study_set_status as enum ('queued', 'processing', 'ready', 'failed');
create type study_set_stage as enum ('queued', 'reading', 'analyzing', 'writing', 'done', 'failed');

-- קוויז ומבחן חולקים מבנה. הטיפוס הזה הוא מה שמבדיל ביניהם.
create type study_item_kind as enum ('quiz', 'exam');

-- ── updated_at ─────────────────────────────────────────────────────────
-- search_path מוצמד: פונקציית טריגר בלי search_path קבוע היא וקטור
-- להשתלטות דרך סכימה שנוצרת על ידי תוקף.

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── פרופילים ───────────────────────────────────────────────────────────

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- פרופיל נוצר אוטומטית עם המשתמש. security definer כי הטריגר רץ
-- בהקשר של auth ולא של המשתמש.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name',
                         new.raw_user_meta_data ->> 'name', '')), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── יחידת הלימוד ───────────────────────────────────────────────────────

create table public.study_sets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 200),
  subject     text check (char_length(subject) <= 60),
  status      study_set_status not null default 'queued',
  stage       study_set_stage not null default 'queued',
  page_count  integer not null default 0 check (page_count >= 0),
  error       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- חומר שנכשל חייב סיבה, אחרת המסך לא יודע מה להגיד לתלמיד
  constraint failed_has_error check (status <> 'failed' or error is not null)
);

create index study_sets_user_created_idx on public.study_sets (user_id, created_at desc);

create trigger study_sets_touch_updated_at
  before update on public.study_sets
  for each row execute function public.touch_updated_at();

-- ── הקובץ שהועלה ───────────────────────────────────────────────────────
-- deleted_at: כלל המחיקה מ-PLAN.md סעיף 7 — קובץ המקור נמחק 24 שעות
-- אחרי עיבוד מוצלח. השורה נשארת בשביל התיעוד, הקובץ עצמו לא.

create table public.documents (
  id           uuid primary key default gen_random_uuid(),
  study_set_id uuid not null references public.study_sets (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  storage_path text not null unique,
  mime_type    text not null,
  size_bytes   bigint not null check (size_bytes > 0),
  checksum     text,
  deleted_at   timestamptz,
  created_at   timestamptz not null default now()
);

create index documents_study_set_idx on public.documents (study_set_id);
-- לעבודת הניקוי: הקבצים שעוד לא נמחקו, לפי גיל
create index documents_pending_purge_idx on public.documents (created_at)
  where deleted_at is null;

-- ── נושאים ─────────────────────────────────────────────────────────────

create table public.topics (
  id           uuid primary key default gen_random_uuid(),
  study_set_id uuid not null references public.study_sets (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 120),
  order_index  integer not null default 0,
  created_at   timestamptz not null default now(),
  unique (study_set_id, name)
);

create index topics_study_set_idx on public.topics (study_set_id, order_index);

-- ── סיכום ──────────────────────────────────────────────────────────────
-- אחד לכל חומר, ולכן ה-study_set_id הוא המפתח הראשי.

create table public.summaries (
  study_set_id uuid primary key references public.study_sets (id) on delete cascade,
  body         text not null check (char_length(body) > 0),
  key_points   jsonb not null default '[]'::jsonb,
  definitions  jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now(),

  constraint key_points_is_array check (jsonb_typeof(key_points) = 'array'),
  constraint definitions_is_array check (jsonb_typeof(definitions) = 'array')
);

-- ── כרטיסיות ───────────────────────────────────────────────────────────

create table public.flashcards (
  id           uuid primary key default gen_random_uuid(),
  study_set_id uuid not null references public.study_sets (id) on delete cascade,
  topic_id     uuid references public.topics (id) on delete set null,
  front        text not null check (char_length(front) > 0),
  back         text not null check (char_length(back) > 0),
  order_index  integer not null default 0,
  created_at   timestamptz not null default now()
);

create index flashcards_study_set_idx on public.flashcards (study_set_id, order_index);
create index flashcards_topic_idx on public.flashcards (topic_id);

-- משוב התלמיד: 0 = לא ידעתי, 1 = כמעט ידעתי, 2 = קל.
-- כל הקשה נרשמת כשורה חדשה ולא מעדכנת — ההיסטוריה היא מה שמזין מאסטרי.
create table public.flashcard_reviews (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  flashcard_id uuid not null references public.flashcards (id) on delete cascade,
  rating       smallint not null check (rating between 0 and 2),
  created_at   timestamptz not null default now()
);

create index flashcard_reviews_user_card_idx
  on public.flashcard_reviews (user_id, flashcard_id, created_at desc);

-- ── שאלות ──────────────────────────────────────────────────────────────
-- קוויז ומבחן באותה טבלה. options הוא מערך של בדיוק ארבע מחרוזות,
-- ו-correct_index חייב להצביע לתוכו — נאכף כאן ולא רק בקוד.

create table public.questions (
  id            uuid primary key default gen_random_uuid(),
  study_set_id  uuid not null references public.study_sets (id) on delete cascade,
  topic_id      uuid references public.topics (id) on delete set null,
  kind          study_item_kind not null,
  stem          text not null check (char_length(stem) > 0),
  options       jsonb not null,
  correct_index smallint not null check (correct_index >= 0),
  explanation   text,
  order_index   integer not null default 0,
  created_at    timestamptz not null default now(),

  constraint options_are_four check (
    jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4
  ),
  constraint correct_index_in_range check (
    correct_index < jsonb_array_length(options)
  )
);

create index questions_set_kind_idx on public.questions (study_set_id, kind, order_index);
create index questions_topic_idx on public.questions (topic_id);

-- ── ניסיונות ───────────────────────────────────────────────────────────
-- קוויז ומבחן באותה טבלה. הניקוד נכתב בשרת בלבד (PLAN.md סעיף 6.5).

create table public.attempts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  study_set_id   uuid not null references public.study_sets (id) on delete cascade,
  kind           study_item_kind not null,
  question_count integer not null check (question_count > 0),
  score          smallint check (score between 0 and 100),
  started_at     timestamptz not null default now(),
  finished_at    timestamptz,

  constraint finished_has_score check (finished_at is null or score is not null)
);

create index attempts_user_set_idx
  on public.attempts (user_id, study_set_id, started_at desc);

create table public.attempt_answers (
  id             uuid primary key default gen_random_uuid(),
  attempt_id     uuid not null references public.attempts (id) on delete cascade,
  question_id    uuid not null references public.questions (id) on delete cascade,
  -- null = השאלה נותרה ללא מענה
  selected_index smallint check (selected_index >= 0),
  is_correct     boolean not null,
  created_at     timestamptz not null default now(),

  unique (attempt_id, question_id)
);

create index attempt_answers_attempt_idx on public.attempt_answers (attempt_id);
create index attempt_answers_question_idx on public.attempt_answers (question_id);

-- ── תשתית עלות ─────────────────────────────────────────────────────────
-- כלל ברזל 7: כל קריאה נרשמת, כולל כשלונות. קריאה שנפלה אחרי שהמודל
-- כבר עבד עלתה כסף, ותקרה שסופרת רק הצלחות היא תקרה שקרית.

create table public.model_calls (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users (id) on delete set null,
  study_set_id      uuid references public.study_sets (id) on delete set null,
  model             text not null,
  input_tokens      integer not null default 0,
  output_tokens     integer not null default 0,
  cache_read_tokens integer not null default 0,
  cost_usd          numeric(10, 6) not null default 0,
  ok                boolean not null,
  error             text,
  created_at        timestamptz not null default now()
);

create index model_calls_created_idx on public.model_calls (created_at desc);
create index model_calls_user_created_idx on public.model_calls (user_id, created_at desc);

-- שורה אחת. משנים אותה ב-SQL בלי לפרוס מחדש את הפונקציה.
create table public.usage_caps (
  id                             boolean primary key default true check (id),
  max_calls_per_month            integer not null check (max_calls_per_month >= 0),
  max_cost_usd_per_month         numeric(10, 2) not null check (max_cost_usd_per_month >= 0),
  max_uploads_per_user_per_month integer not null check (max_uploads_per_user_per_month >= 0),
  updated_at                     timestamptz not null default now()
);

insert into public.usage_caps
  (max_calls_per_month, max_cost_usd_per_month, max_uploads_per_user_per_month)
values (500, 25.00, 8);

create trigger usage_caps_touch_updated_at
  before update on public.usage_caps
  for each row execute function public.touch_updated_at();
