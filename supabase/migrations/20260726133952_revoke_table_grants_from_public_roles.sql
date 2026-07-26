-- RLS בלי policies כבר חוסמת כל שורה מול anon, אבל ההרשאות עצמן קיימות:
-- Supabase מעניקה ל-anon ול-authenticated הרשאות טבלה כברירת מחדל.
--
-- זה אומר שביטול RLS בטעות על טבלה אחת — פקודה אחת — חושף את כל החומרים
-- של כל התלמידים. שתי שכבות ולא אחת: גם RLS חוסמת, וגם אין הרשאה בכלל.
--
-- service_role לא נוגע בזה: הוא עוקף RLS ושומר על ההרשאות שלו, ולכן
-- ה-Edge Functions ממשיכות לעבוד.
revoke all on table materials from anon, authenticated;
revoke all on table model_calls from anon, authenticated;
revoke all on table usage_caps from anon, authenticated;
