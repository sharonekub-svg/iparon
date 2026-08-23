# LamdAI

אתר לימודים בעברית לתלמידים בישראל. התלמיד מעלה PDF או מצלם דף סיכום,
והמערכת מחזירה סיכום מסודר, כרטיסיות, קוויז ומבחן תרגול — הכול בעברית,
והכול מבוסס אך ורק על החומר שהועלה.

השם זמני. הוא יושב ב-`src/lib/brand.ts` ורק שם.

## מצב נוכחי

**שלב 2 מתוך 15.** השלד עומד: Next.js 16, Tailwind v4, RTL, מערכת העיצוב
ודף הנחיתה. אין עדיין התחברות, העלאה או עיבוד.

התוכנית המלאה — ארכיטקטורה, סכימת בסיס הנתונים, פייפליין ה-AI, עלויות
ותוכנית 15 השלבים — ב-[`docs/PLAN.md`](docs/PLAN.md).

## הרצה

```bash
npm install
npm run dev        # http://localhost:3000
npm run verify     # typecheck + lint + format + build
```

בשלב הזה האתר רץ בלי משתני סביבה. משהתחברות תיכנס, יידרש `.env.local`
לפי [`.env.example`](.env.example).

## פריסה

האתר רץ בוורסל מהענף `claude/lamdai-hebrew-education-mvp-db3q2x`, שהוא
ברירת המחדל של הריפו. הבנייה נבדקה **בלי שום משתנה סביבה**, כדי שהפריסה
הראשונה לא תיפול.

בוורסל צריך שניים בלבד:

```
NEXT_PUBLIC_SUPABASE_URL=https://ecokutjdqppemewxyvat.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
NEXT_PUBLIC_SITE_URL=https://<הדומיין>
```

`SUPABASE_SERVICE_ROLE_KEY` **לא נדרש ולא צריך להיות שם** — הוא עוקף RLS,
ואין בקוד האתר שום קריאה שמשתמשת בו.

אחרי הפריסה הראשונה, להוסיף את הדומיין ב-Supabase תחת
**Authentication → URL Configuration** — אחרת ההתחברות מפנה חזרה
ל-localhost.

## מבנה

```
src/
  app/                מסכים (App Router)
    layout.tsx        RTL, פונטים, מטא־דאטה
    page.tsx          דף הנחיתה
    globals.css       מערכת העיצוב — @theme של Tailwind v4
  lib/
    brand.ts          שם המוצר, במקום אחד
design/               קובץ העיצוב — המקור למערכת העיצוב
docs/PLAN.md          התוכנית
```

## כללי העבודה

[`AGENTS.md`](AGENTS.md) — כללי הברזל, RTL, ומה לבדוק לפני שאומרים "סיימתי".

## רישיון

[MIT](LICENSE)
