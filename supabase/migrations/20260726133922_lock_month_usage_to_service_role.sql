-- month_usage() חוזרת את ההוצאה והשימוש החודשי — נתון שאין שום סיבה
-- שיהיה נגיש למי שמחזיק את מפתח ה-anon, כלומר לכל מי שמחזיק את האפליקציה.
--
-- שני מקורות הרשאה, ושניהם צריכים לרדת:
-- 1. Postgres מעניקה EXECUTE ל-PUBLIC אוטומטית על כל פונקציה חדשה.
-- 2. Supabase מגדירה default privileges שמעניקות EXECUTE ל-anon
--    ול-authenticated ישירות — ולכן revoke מ-PUBLIC לבדו לא חוסם כלום.
revoke all on function month_usage() from public, anon, authenticated;
grant execute on function month_usage() to service_role;
