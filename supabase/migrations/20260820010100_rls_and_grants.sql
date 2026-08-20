-- LamdAI — RLS והרשאות
--
-- שתי שכבות, ושתיהן נחוצות:
--   1. RLS מחליטה אילו *שורות* נראות.
--   2. GRANT מחליט אם לתפקיד יש גישה ל*טבלה* בכלל.
-- RLS בלי שלילת grants היא חצי נעילה. Supabase נותנת כברירת מחדל
-- הרשאות רחבות ל-anon ול-authenticated, ולכן ההגירה הזאת שוללת הכול
-- ומחזירה רק את מה שנדרש.
--
-- service_role עוקף RLS. הוא של ה-Edge Function ושל קוד השרת בלבד,
-- ולעולם לא מגיע לדפדפן.

-- ── RLS על כל טבלה ─────────────────────────────────────────────────────

alter table public.profiles          enable row level security;
alter table public.study_sets        enable row level security;
alter table public.documents         enable row level security;
alter table public.topics            enable row level security;
alter table public.summaries         enable row level security;
alter table public.flashcards        enable row level security;
alter table public.flashcard_reviews enable row level security;
alter table public.questions         enable row level security;
alter table public.attempts          enable row level security;
alter table public.attempt_answers   enable row level security;
alter table public.model_calls       enable row level security;
alter table public.usage_caps        enable row level security;

-- ── פרופיל ─────────────────────────────────────────────────────────────

create policy profiles_select_own on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- ── יחידת הלימוד ───────────────────────────────────────────────────────
-- אין policy של update: את status, stage ואת התוכן כותב רק העובד,
-- שרץ עם service role. תלמיד שיכול לעדכן study_sets יכול לסמן חומר
-- כ-ready בלי שעבר עיבוד.

create policy study_sets_select_own on public.study_sets
  for select to authenticated using ((select auth.uid()) = user_id);

create policy study_sets_insert_own on public.study_sets
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy study_sets_delete_own on public.study_sets
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ── מסמכים ─────────────────────────────────────────────────────────────
-- insert מותר, אבל רק לחומר שהוא שלך — אחרת אפשר לתלות מסמך
-- על ה-study_set של מישהו אחר.

create policy documents_select_own on public.documents
  for select to authenticated using ((select auth.uid()) = user_id);

create policy documents_insert_own on public.documents
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.study_sets s
      where s.id = study_set_id and s.user_id = (select auth.uid())
    )
  );

-- ── תוכן שנוצר מהמודל: קריאה בלבד ──────────────────────────────────────
-- אין policy של insert/update/delete על ארבע הטבלאות האלה, בכוונה.
-- הן נכתבות אך ורק על ידי העובד. תוכן שנוצר מהמודל אינו ניתן לעריכה
-- מהדפדפן, נקודה.

create policy topics_select_via_set on public.topics
  for select to authenticated using (
    exists (
      select 1 from public.study_sets s
      where s.id = study_set_id and s.user_id = (select auth.uid())
    )
  );

create policy summaries_select_via_set on public.summaries
  for select to authenticated using (
    exists (
      select 1 from public.study_sets s
      where s.id = study_set_id and s.user_id = (select auth.uid())
    )
  );

create policy flashcards_select_via_set on public.flashcards
  for select to authenticated using (
    exists (
      select 1 from public.study_sets s
      where s.id = study_set_id and s.user_id = (select auth.uid())
    )
  );

create policy questions_select_via_set on public.questions
  for select to authenticated using (
    exists (
      select 1 from public.study_sets s
      where s.id = study_set_id and s.user_id = (select auth.uid())
    )
  );

-- ── משוב על כרטיסיות ───────────────────────────────────────────────────
-- כתיבה ישירה מהדפדפן: זו פעולה בתדירות גבוהה (כל הפיכת כרטיסייה),
-- וערך הזיוף בה אפסי — תלמיד שמשקר לעצמו פוגע רק בעצמו. עדיין
-- מאומת שהכרטיסייה שייכת לחומר שלו.

create policy flashcard_reviews_select_own on public.flashcard_reviews
  for select to authenticated using ((select auth.uid()) = user_id);

create policy flashcard_reviews_insert_own on public.flashcard_reviews
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.flashcards f
      join public.study_sets s on s.id = f.study_set_id
      where f.id = flashcard_id and s.user_id = (select auth.uid())
    )
  );

-- ── ניסיונות: קריאה בלבד ───────────────────────────────────────────────
-- כל כתיבה עוברת דרך /api/attempts עם service role. אין policy של
-- insert או update, ולכן אי אפשר להמציא ניסיון או לכתוב לעצמך ציון.
-- זה מה שהופך את ציון המבחן לאמין (PLAN.md סעיף 6.5).

create policy attempts_select_own on public.attempts
  for select to authenticated using ((select auth.uid()) = user_id);

create policy attempt_answers_select_via_attempt on public.attempt_answers
  for select to authenticated using (
    exists (
      select 1 from public.attempts a
      where a.id = attempt_id and a.user_id = (select auth.uid())
    )
  );

-- ── תשתית עלות: בלי policies בכלל ──────────────────────────────────────
-- model_calls ו-usage_caps נשארות בלי שום policy. RLS פעילה, אין
-- מדיניות, ולכן מול anon ו-authenticated הן חסומות לחלוטין. רק
-- service role נוגע בהן.

-- ── שלילת הרשאות ───────────────────────────────────────────────────────

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

-- ולעתיד: טבלה חדשה לא תקבל הרשאות אוטומטית
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

-- ── החזרת המינימום ההכרחי ל-authenticated ──────────────────────────────

grant select                 on public.profiles          to authenticated;
grant update (display_name)  on public.profiles          to authenticated;

grant select, insert, delete on public.study_sets        to authenticated;
grant select, insert         on public.documents         to authenticated;

grant select                 on public.topics            to authenticated;
grant select                 on public.summaries         to authenticated;
grant select                 on public.flashcards        to authenticated;
grant select                 on public.questions         to authenticated;

grant select, insert         on public.flashcard_reviews to authenticated;

grant select                 on public.attempts          to authenticated;
grant select                 on public.attempt_answers   to authenticated;

-- model_calls ו-usage_caps: שום הרשאה, לשום תפקיד ציבורי.
-- anon: שום הרשאה על שום טבלה. מי שלא מחובר לא רואה כלום.
