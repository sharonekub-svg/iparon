-- LamdAI — נעילת פונקציות הטריגר
--
-- הלינטר של Supabase תפס את זה, ובצדק: handle_new_user היא
-- SECURITY DEFINER והייתה ניתנת להרצה דרך /rest/v1/rpc/ על ידי anon.
--
-- למה ה-revoke בהגירה הקודמת לא כיסה את זה: לפונקציה יש הרשאת EXECUTE
-- שניתנת כברירת מחדל ל-PUBLIC — הפסאודו־תפקיד — ולא ל-anon או
-- ל-authenticated בשמם. `revoke ... from anon, authenticated` מסיר
-- הרשאה ישירה, ולא את מה שהם יורשים מ-PUBLIC. צריך לשלול מ-PUBLIC.
--
-- פונקציות טריגר לא צריכות EXECUTE לאף אחד: הן רצות בהקשר הטריגר,
-- בהרשאות בעל הטבלה.

revoke all on function public.handle_new_user()  from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;

-- ולעתיד: כל פונקציה חדשה בסכימה לא תקבל EXECUTE אוטומטי ל-PUBLIC
alter default privileges in schema public revoke all on functions from public;
