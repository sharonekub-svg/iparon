-- LamdAI — שינוי שם לחומר
--
-- המודל בוחר את הכותרת, ולפעמים היא לא מדויקת. עד עכשיו לא הייתה
-- דרך לתקן אותה: ל-authenticated אין בכלל update על study_sets.
--
-- ההרשאה ניתנת **ברמת עמודה**, על title בלבד. status ו-stage נשארים
-- חסומים לחלוטין — מי שיכול לכתוב להם יכול לסמן חומר כ-ready בלי
-- שעבר עיבוד. זו אותה הפרדה שכבר קיימת ב-profiles.display_name.

create policy study_sets_update_own on public.study_sets
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant update (title) on public.study_sets to authenticated;
