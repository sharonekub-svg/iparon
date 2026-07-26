-- הלינטר של Supabase סימן את זה: פונקציה בלי search_path קבוע חשופה
-- להשתלה — מי שיכול ליצור אובייקט בסכימה שקודמת ב-search_path יכול להחליף
-- את מה שהפונקציה קוראת. month_usage() כבר מוגדרת עם search_path,
-- ל-touch_updated_at זה היה חסר.
alter function touch_updated_at() set search_path = public;
