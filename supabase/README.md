# השרת

סכימה אחת, פרוסה. הפונקציה `process-material` נכנסת בשלב 7.

## הפרויקט הפרוס

|             |                                            |
| ----------- | ------------------------------------------ |
| Project ref | `ecokutjdqppemewxyvat`                     |
| URL         | `https://ecokutjdqppemewxyvat.supabase.co` |
| אזור        | `eu-central-1` (פרנקפורט) — ~50ms מישראל   |
| תוכנית      | Free — $0 לחודש                            |

**האזור נבחר ביצירה ואי אפשר להחליף אותו אחר כך.** פרויקט חינמי נעצר
אחרי 7 ימי חוסר פעילות; לפני משתמשים אמיתיים צריך Pro.

## ההגירות

מקור האמת הוא הקבצים כאן, והם תואמים בדיוק את מה שרשום ב-DB.

| קובץ                           | מה הוא עושה                                                  |
| ------------------------------ | ------------------------------------------------------------ |
| `…_init_schema.sql`            | 12 טבלאות, טיפוסים, אינדקסים, טריגרים, יצירת פרופיל אוטומטית |
| `…_rls_and_grants.sql`         | RLS על הכול + שלילת הרשאות והחזרת המינימום                   |
| `…_storage.sql`                | bucket `materials` פרטי + מדיניות לפי תיקיית המשתמש          |
| `…_mastery_and_usage.sql`      | `topic_mastery` כ-VIEW, ופונקציות התקרה                      |
| `…_lock_trigger_functions.sql` | שלילת EXECUTE מ-PUBLIC על פונקציות הטריגר                    |

פריסה מחדש:

```bash
npx supabase login
npx supabase link --project-ref ecokutjdqppemewxyvat
npx supabase db push
```

## מודל ההרשאות

שתי שכבות, ושתיהן נחוצות: **RLS** מחליטה אילו שורות נראות, **GRANT**
מחליט אם לתפקיד יש גישה לטבלה בכלל. RLS בלי שלילת grants היא חצי נעילה.

| טבלה                                             | `anon` | `authenticated`                    |
| ------------------------------------------------ | ------ | ---------------------------------- |
| `profiles`                                       | —      | select, update(display_name) — שלו |
| `study_sets`                                     | —      | select, insert, delete — שלו       |
| `documents`                                      | —      | select, insert — שלו               |
| `topics`, `summaries`, `flashcards`, `questions` | —      | select בלבד, דרך בעלות על החומר    |
| `flashcard_reviews`                              | —      | select, insert — שלו               |
| `attempts`, `attempt_answers`                    | —      | **select בלבד**                    |
| `model_calls`, `usage_caps`                      | —      | **שום דבר**                        |

**למה `attempts` היא קריאה בלבד.** כל כתיבה עוברת דרך `/api/attempts` עם
service role. תלמיד שיכול לכתוב ל-`attempts` יכול לכתוב לעצמו ציון,
וזה מרוקן מתוכן את הציון במבחן.

**למה אין policies על `topics`/`summaries`/`flashcards`/`questions` לכתיבה.**
הן נכתבות אך ורק על ידי העובד. תוכן שנוצר מהמודל אינו ניתן לעריכה
מהדפדפן, נקודה.

**למה `model_calls` ו-`usage_caps` בלי policies בכלל.** RLS פעילה, אין
מדיניות, ולכן מול כל תפקיד ציבורי הן חסומות לחלוטין. הלינטר מסמן את זה
כ-INFO — זה בכוונה, זו חסימה מלאה ולא שכחה.

## מה אומת בפועל

מול הפרויקט הפרוס, עם שני משתמשי בדיקה A ו-B:

- B ראה **0 שורות** בכל אחת מהטבלאות של A, ו-`topic_mastery` ריק
- A ראה בדיוק שורה אחת בכל טבלה, ואת הפרופיל שלו בלבד
- B ניסה ליצור `study_sets` עם `user_id` של A → נדחה ב-RLS
- A ניסה לעדכן את הציון שלו ב-`attempts` → `permission denied`
- A ניסה לקרוא `model_calls` → `permission denied`
- B ניסה לרשום משוב על כרטיסייה של A → נדחה ב-RLS
- `anon` ניסה לקרוא `study_sets` → `permission denied`
- מחיקת המשתמש מ-`auth.users` גררה מחיקה של הפרופיל, החומר, הכרטיסיות,
  הניסיונות והמסמכים — מחיקת חשבון מוחקת הכול
- הלינטר של Supabase: **0 שגיאות, 0 אזהרות** (נשארו שתי הודעות INFO
  על "RLS enabled no policy", והן מכוונות)

נתוני הבדיקה נמחקו. ה-DB ריק.

**לא אומת:** שום קריאה אמיתית למודל. זה נכנס בשלב 7, יחד עם
`process-material` ועם `supabase secrets set ANTHROPIC_API_KEY`.

## התקרה

```sql
-- לצפייה
select * from usage_caps;
select * from month_usage();

-- לשינוי
update usage_caps set max_cost_usd_per_month = 50, max_uploads_per_user_per_month = 12;
```

ברירת המחדל: 500 עיבודים בחודש, $25, ו-8 העלאות למשתמש בחודש.

## העובד: `process-material`

פרוס ופעיל. מריץ, מאמת קלט, ומגיע ל-DB — אומת בקריאה אמיתית
(`404 החומר לא נמצא` על מזהה שגוי, `400 חסר מזהה חומר` על גוף ריק).

**מה שנשאר כדי שיעבוד באמת:**

```bash
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
# אופציונלי — החלפת מודל בלי לפרוס מחדש:
npx supabase secrets set LAMDAI_MODEL=claude-sonnet-5
```

בלי המפתח כל העלאה תיכשל עם `חסר משתנה סביבה: ANTHROPIC_API_KEY`,
החומר יסומן `failed` עם הודעה בעברית — **ולא יעלה כלום.**

### מגבלות הקלט

|                  |                                              |
| ---------------- | -------------------------------------------- |
| קבצים בהעלאה אחת | עד 20 (תמונות), או PDF אחד                   |
| גודל קובץ        | 15MB                                         |
| סך הכול          | 25MB                                         |
| סוגים            | `application/pdf`, `image/jpeg`, `image/png` |

הסוג נבדק פעמיים: Storage אוכף `allowed_mime_types`, והעובד בודק
**magic bytes** על התוכן עצמו — כי הסיומת וה-MIME שהלקוח הצהיר עליהם
נשלטים על ידי מי שמעלה.

### הערה על הפריסה

הפריסה הראשונה נעשתה דרך ה-MCP, והבנדל שעלה זהה פונקציונלית לקוד
שבריפו אבל עם פחות הערות. מקור האמת הוא הריפו; `npx supabase functions
deploy process-material` מסנכרן את השניים.
