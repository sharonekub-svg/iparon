-- ── סיכום מחולק לפרקים ───────────────────────────────────────────────
--
-- הסיכום הוא הפיצ'ר המרכזי של המוצר, ופסקאות רצופות בלי כותרות קשות
-- לסריקה בזמן חזרה למבחן. המודל מחזיר עכשיו פרק לכל נושא, והפרקים
-- נשמרים כאן. עמודת body נשארת מקור האמת הפשוט — אותו תוכן כטקסט אחד —
-- כדי שחומר שכבר עובד לא יישבר.

alter table public.summaries
  add column if not exists sections jsonb not null default '[]'::jsonb;

alter table public.summaries
  drop constraint if exists sections_is_array;

alter table public.summaries
  add constraint sections_is_array check (jsonb_typeof(sections) = 'array');

comment on column public.summaries.sections is
  'מערך של {heading, body}. ריק בחומר שעובד לפני השינוי — אז מציגים את body.';

notify pgrst, 'reload schema';
