# השרת

שתי פונקציות Edge וסכימה אחת. הכול פרוס לפרויקט Supabase אחד.

## הפרויקט הפרוס

| | |
|---|---|
| Project ref | `fqunvywtgtjnpicxjxtc` |
| URL | `https://fqunvywtgtjnpicxjxtc.supabase.co` |
| Region | `ap-southeast-2` (Sydney) |

הסכימה, שתי הפונקציות וההרשאות כבר פרוסות ומאומתות. **מה שנשאר: מפתח המודל.**

```bash
npx supabase login
npx supabase link --project-ref fqunvywtgtjnpicxjxtc
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

בלי הצעד הזה כל העלאה תיכשל עם `חסר משתנה סביבה: ANTHROPIC_API_KEY`,
והחומר יסומן `failed` — בלי לעלות כלום.

## פריסה מחדש

```bash
npx supabase db push
npx supabase functions deploy analyze
npx supabase functions deploy materials
```

היסטוריית ההגירות בקבצים כאן תואמת בדיוק את מה שרשום ב-DB, ולכן
`db push` על הפרויקט הזה הוא no-op ולא ינסה להריץ שוב את הסכימה.

`SUPABASE_URL` ו-`SUPABASE_SERVICE_ROLE_KEY` מוזרקים אוטומטית לפונקציות ואין
צורך להגדיר אותם.

אופציונלי: `npx supabase secrets set SHINUN_MODEL=claude-sonnet-5` מחליף את
המודל בלי לשנות קוד. ברירת המחדל היא `claude-opus-5`.

## מה יש כאן

| קובץ | מה הוא עושה |
|---|---|
| `migrations/…_init_shinun_schema.sql` | טבלאות `materials`, `model_calls`, `usage_caps`, ו-RLS |
| `migrations/…_lock_month_usage_*.sql` | חסימת `month_usage()` מול anon |
| `migrations/…_revoke_table_grants_*.sql` | הסרת הרשאות טבלה מ-anon |
| `migrations/…_pin_touch_updated_at_*.sql` | `search_path` קבוע לפונקציית הטריגר |
| `functions/analyze` | POST: מקבל קובץ, פותח חומר במצב "בעיבוד", ומעבד ברקע |
| `functions/materials` | GET: רשימת החומרים של מכשיר, או חומר אחד עם התוצאה |
| `functions/_shared/model.ts` | הפרומפט, הסכימה, והקריאה היחידה למודל |
| `functions/_shared/studySet.ts` | החוזה + ולידציה בזמן ריצה |
| `functions/_shared/db.ts` | גישה ל-DB + בדיקת התקרה החודשית |

## למה RLS חוסמת הכול

אין התחברות בגרסה הזאת, ולכן אין `auth.uid()` לבנות עליו מדיניות. השיוך הוא
ל-`device_id` אנונימי, שנוצר במכשיר — וזה לא סוד שאפשר לסמוך עליו במדיניות
RLS. לכן הטבלאות חסומות לחלוטין מול מפתח ה-anon שיש לאפליקציה, וכל גישה
עוברת דרך הפונקציות, שרצות עם service role ומאמתות את ה-`device_id` בעצמן.

כשתתווסף התחברות: מחליפים `device_id` ב-`auth.uid()`, פותחים policy לקריאה,
והאפליקציה יכולה לקרוא ישירות בלי הפונקציה `materials`.

## התקרה החודשית

כלל ברזל 7. כל קריאה למודל נרשמת ב-`model_calls`, כולל קריאות שנכשלו — קריאה
שנפלה אחרי שהמודל עבד עלתה כסף. לפני כל עיבוד `analyze` בודקת את הסכום מול
`usage_caps`, ומחזירה 429 עם הודעה בעברית כשהמסגרת נגמרה.

לשינוי התקרה:

```sql
update usage_caps set max_calls_per_month = 1000, max_cost_usd_per_month = 50;
```

לצפייה בשימוש:

```sql
select * from month_usage();
select date_trunc('day', created_at) as day, count(*), sum(cost_usd)
from model_calls group by 1 order by 1 desc;
```

`cost_usd` הוא אומדן לפי המחירון ב-`_shared/model.ts` — אם המחירון משתנה,
מעדכנים אותו שם. הוא לא מחליף את החיוב האמיתי בקונסולה.

## למה העיבוד ברקע

`analyze` מחזירה 202 מיד ומעבדת ברקע דרך `EdgeRuntime.waitUntil`. קריאה למודל
על דף סרוק לוקחת עשרות שניות ולפעמים יותר, וזה ארוך מדי כדי להשאיר תלמיד מול
מסך טעינה על רשת סלולרית. החומר מופיע ברשימה במצב "בעיבוד", ומסך הבית מתעדכן
בכניסה למסך או במשיכה למטה.

**המגבלה שנשארת:** גם ריצה ברקע כפופה למגבלת הזמן של Edge Functions. קובץ עם
הרבה עמודים עלול להיחתך, והחומר יסומן `failed`. מגבלת הקובץ כרגע היא 15MB,
ואם יתברר שעמודים ארוכים נחתכים — הפתרון הוא לפצל את הקובץ לקבוצות עמודים
ולאחד את התוצאות, וזה עוד לא נבנה.

## מה אומת בפועל, ומה לא

אומת מול הפרויקט הפרוס:

- הסכימה קיימת, `usage_caps` מכיל שורה אחת (500 עיבודים, 25 דולר)
- `month_usage()` מחזירה 0 ו-0, ו-anon **לא** יכול להריץ אותה
- ל-anon אין שום הרשאה על שלוש הטבלאות (לא select ולא insert)
- ל-service_role יש את כל מה שהפונקציות צריכות
- הלינטר של Supabase נקי מאזהרות (נשארו שלוש הודעות INFO על
  "RLS enabled no policy" — זה בכוונה, זו חסימה מלאה)
- שתי הפונקציות במצב ACTIVE עם `verify_jwt` פעיל

**לא אומת:** אף קריאה אמיתית לפונקציות. הסביבה שממנה נפרסו חוסמת יציאה
ל-`*.supabase.co`, ולכן ההרצה הראשונה של `analyze` תהיה מהאפליקציה שלך.

## בדיקה מקומית

```bash
npx supabase functions serve --env-file .env.local
curl -i -X POST http://localhost:54321/functions/v1/analyze \
  -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d "{\"deviceId\":\"test\",\"title\":\"בדיקה\",\"source\":\"pdf\",\"mediaType\":\"application/pdf\",\"fileBase64\":\"$(base64 -w0 sample.pdf)\"}"
```

הפונקציות הן קוד Deno ולא נכללות ב-`tsc` של האפליקציה. לבדיקת טיפוסים:

```bash
cd supabase/functions && deno check analyze/index.ts materials/index.ts
```
