-- LamdAI — נתיב האחסון חייב להיות בתיקייה של הבעלים
--
-- פרצה שנמצאה בביקורת: startProcessing קיבל את storage_path מהלקוח
-- והכניס אותו כמו שהוא. ה-RLS על documents בדק ש-user_id הוא המשתמש
-- ושהחומר שלו — אבל לא שהנתיב נמצא בתיקייה שלו.
--
-- התקיפה: משתמש A שולח את מזהה החומר שלו עם נתיב של קובץ של משתמש B.
-- העובד רץ ב-service role, שעוקף RLS ואת מדיניות ה-Storage, מוריד את
-- הקובץ של B ומייצר ממנו סיכום וכרטיסיות בחומר של A.
--
-- האכיפה כאן ולא בקוד: service role עוקף מדיניות, ולכן בדיקה בשכבת
-- האפליקציה בלבד נשענת על כך שכל מסלול כתיבה עתידי יזכור לבדוק.
-- constraint לא שוכח.
--
-- הנתיב נבנה כ-{user_id}/{study_set_id}/{index}.{ext}, ולכן המקטע
-- הראשון חייב להיות מזהה הבעלים — בדיוק כמו שמדיניות ה-Storage אוכפת
-- מול הדפדפן.

alter table public.documents
  add constraint storage_path_belongs_to_owner
  check (split_part(storage_path, '/', 1) = user_id::text);
