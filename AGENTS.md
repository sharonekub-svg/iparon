# כללי העבודה בריפו הזה

## הסטאק

אתר Next.js. **לא אפליקציית Expo** — האפליקציה שהייתה כאן נמחקה.

|            |                                                           |
| ---------- | --------------------------------------------------------- |
| Next.js    | 16.3 — App Router                                         |
| React      | 19.2                                                      |
| Tailwind   | v4 — הקונפיג ב-CSS דרך `@theme`, אין `tailwind.config.js` |
| TypeScript | 5                                                         |
| Backend    | Supabase — Postgres, Auth, Storage, Edge Functions        |
| פריסה      | Vercel                                                    |

**Next 16 שינה דברים. קרא את התיעוד המדויק לגרסה לפני שאתה כותב קוד:**
https://nextjs.org/docs — ובמיוחד https://nextjs.org/docs/app/guides/upgrading/version-16

מלכודת שכבר נתקלנו בה: **`middleware.ts` הוחלף ב-`proxy.ts`**, והפונקציה
המיוצאת נקראת `proxy` ולא `middleware`. היא רצה על Node.js ולא על Edge.
קובץ `middleware.ts` פשוט לא ירוץ, בלי שגיאה.

## כללי ברזל

1. **מפתח ה-API של המודל נמצא רק ב-Secrets של ה-Edge Function.** אף פעם לא
   בקוד האתר, ואף פעם לא במשתנה `NEXT_PUBLIC_*`. אותו דבר לגבי
   `SUPABASE_SERVICE_ROLE_KEY`.
2. **המודל נקרא רק מ-`process-material`.** לא מהדפדפן, לא מ-Route Handler.
3. **עיבוד אחד לכל חומר.** פתיחת סיכום, כרטיסיות, קוויז או מבחן היא קריאת
   DB בלבד. אם משהו קורא למודל פעם שנייה על אותו חומר — זה באג.
4. **בלי OCR ובלי חילוץ טקסט מ-PDF.** עברית נשברת בשתי הדרכים: כתב יד לא
   מזוהה, ו-PDF עברי מחזיר טקסט הפוך ומשובש בלי להתריע. כל עמוד נשלח
   כתמונה למודל ראייה.
5. **הרשאה נאכפת ב-RLS.** בדיקה בפרונט היא UX, לא אבטחה.
6. **הפרומפט מצהיר במפורש:** כל הפלט בעברית, אך ורק מהחומר שהועלה, בלי
   ידע חיצוני, בלי להמציא.
7. **תקרת הוצאה.** כל קריאה למודל נרשמת, כולל כשלונות. מעל התקרה — עצירה.

## RTL

עברית היא שפת הממשק. `dir="rtl"` על `<html>` הוא ההתחלה, לא הסוף.

- **רק logical properties.** `ms-*`/`me-*`/`ps-*`/`pe-*`/`start-*`/`end-*`.
  אף פעם לא `ml-*`/`mr-*`/`pl-*`/`pr-*`/`left-*`/`right-*`.
- **חצים כ-SVG, לא כתווים.** תווים כמו `‹` הם bidi-mirrored ומתהפכים לבד.
- **כל מחרוזת בממשק מתחילה במילה עברית.** מחרוזת שמתחילה במילה לטינית
  (למשל "PDF או צילום") מקבלת כיוון פסקה LTR ומילותיה מסתדרות הפוך.
- **מספר בודד בתוך טקסט עברי** מקבל `.num` (מוגדר ב-`globals.css`).
  `.num` עוטף **מספר בלבד**, אף פעם לא מחרוזת מעורבת: על `6 עמודים` הוא
  כופה `direction: ltr` על כל המחרוזת, וקורא עברי רואה "עמודים" לפני "6".

## עיצוב

מערכת העיצוב יושבת ב-`design/`, וכל הערכים שלה מיוצגים ב-`@theme` בתוך
`src/app/globals.css`. צבע או גודל חדש נכנס לטוקנים, לא לתוך מסך בודד.

## הרצה בסשן ענן

`fetch` של Node לא עובר דרך ה-proxy של הסביבה כברירת מחדל — הוא יוצא
ישירות, נתפס בדרך, ומקבל `Host not in allowlist` גם כשהדומיין מותר.
זה נראה בדיוק כמו חסימת רשת, ולכן מבזבז זמן.

בסשן ענן מריצים כך:

```bash
NODE_USE_ENV_PROXY=1 npm run dev
```

מקומית זה לא נדרש, ובוורסל בוודאי שלא. אל תכניס את זה לקוד האפליקציה.

## לפני שאתה אומר שסיימת

```bash
npm run verify   # typecheck + lint + format:check + build
```

ובנוסף — מבט אמיתי בממשק ב-360px. mobile-first זה לא סיסמה: רוב התלמידים
ייכנסו מהטלפון.

## התוכנית

`docs/PLAN.md` הוא מסמך התכנון — ארכיטקטורה, סכימה, פייפליין, עלויות
ותוכנית השלבים. מה שמשתנה בדרך מתעדכן שם.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
