import Link from 'next/link';

import { brand } from '@/lib/brand';

/**
 * דף הנחיתה. תפקידו להסביר את המוצר בכמה שניות ולהוציא את המבקר
 * להרשמה — לא להרשים. בלי גרדיאנטים, בלי אנימציות, בלי בלוקי טקסט ארוכים.
 */

const steps = [
  {
    n: '01',
    title: 'מעלים את החומר',
    body: 'סיכום, דף מחברת מצולם, או PDF של פרק שלם. גם כתב יד.',
  },
  {
    n: '02',
    title: 'המערכת קוראת אותו',
    body: 'מזהה את הנושאים, ובונה מהם סיכום, כרטיסיות ושאלות — רק ממה שכתוב בדף.',
  },
  {
    n: '03',
    title: 'לומדים ונבחנים',
    body: 'כרטיסיות, קוויז ומבחן תרגול. בסוף רואים במה אתה חזק ובמה כדאי לחזור.',
  },
];

function ArrowStart({ className = '' }: { className?: string }) {
  // חץ מצויר ולא תו. תווים כמו ‹ הם bidi-mirrored ומתהפכים לבד לפי
  // כיוון הפסקה, ואז הכפתור מצביע לכיוון ההפוך.
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={`size-4 shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 3 5 8l5 5" />
    </svg>
  );
}

export default function LandingPage() {
  return (
    <>
      <header className="border-line border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <span className="text-meta text-ink font-mono">{brand.name}</span>
          <Link
            href="/login"
            className="text-label text-ink-muted hover:text-ink transition-colors"
          >
            כניסה
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-5">
        {/* ── הירו ────────────────────────────────────────────────── */}
        <section className="pt-14 pb-16 sm:pt-20">
          <h1 className="text-display text-ink max-w-xl">
            תהפוך את החומר שלך ללמידה חכמה
          </h1>
          <p className="text-lead text-ink-body mt-5 max-w-lg">
            העלה סיכום, מחברת או PDF וקבל סיכום, כרטיסיות, שאלות ומבחן — במקום אחד.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/signup"
              className="bg-ink text-label text-on-ink inline-flex items-center justify-center gap-2 rounded-md px-6 py-3.5 transition-opacity hover:opacity-90"
            >
              התחל ללמוד
              <ArrowStart />
            </Link>
            <Link
              href="/demo"
              className="border-line-input text-label text-ink hover:bg-surface-sunk inline-flex items-center justify-center rounded-md border px-6 py-3.5 transition-colors"
            >
              נסה בלי הרשמה
            </Link>
          </div>

          <p className="text-meta text-ink-faint mt-5">חינם. הכול בעברית.</p>
        </section>

        {/* ── תצוגה מקדימה ────────────────────────────────────────── */}
        <section aria-labelledby="preview-heading" className="pb-16">
          <h2 id="preview-heading" className="sr-only">
            כך נראית התוצאה
          </h2>

          <Link
            href="/demo"
            className="border-line-strong bg-surface hover:border-ink block overflow-hidden rounded-xl border transition-colors"
          >
            <div className="border-line flex items-center justify-between border-b px-5 py-3.5">
              <span className="text-label text-ink">ביולוגיה — מערכת העיכול</span>
              <span className="text-meta text-ink-faint font-mono">6 עמודים</span>
            </div>

            <div className="border-line text-label flex gap-1 border-b px-3 py-2">
              <span className="bg-surface-sunk text-ink rounded-xs px-3 py-1.5">
                סיכום
              </span>
              <span className="text-ink-faint px-3 py-1.5">כרטיסיות</span>
              <span className="text-ink-faint px-3 py-1.5">תרגול</span>
              <span className="text-ink-faint px-3 py-1.5">מבחן</span>
            </div>

            <div className="space-y-4 px-5 py-5">
              <p className="text-small text-ink-body">
                העיכול מתחיל בפה, שם האנזים עמילאז ברוק מפרק עמילן לסוכרים פשוטים. מהוושט
                המזון מגיע לקיבה, שבה חומצת מלח מפעילה את פפסין לפירוק חלבונים.
              </p>
              <div className="border-line bg-paper rounded-md border px-4 py-3">
                <p className="text-meta text-ink-faint">כרטיסייה</p>
                <p className="text-small text-ink mt-1.5">
                  איזה אנזים מפרק עמילן, והיכן הוא פועל?
                </p>
              </div>
            </div>
          </Link>

          <p className="text-meta text-ink-faint mt-3">
            כך נראה חומר אחרי עיבוד. הקש כדי להתנסות בעצמך.
          </p>
        </section>

        {/* ── איך זה עובד ─────────────────────────────────────────── */}
        <section aria-labelledby="how-heading" className="border-line border-t py-14">
          <h2 id="how-heading" className="text-heading text-ink">
            איך זה עובד
          </h2>
          <ol className="mt-8 space-y-8">
            {steps.map((step) => (
              <li key={step.n} className="flex gap-4">
                <span className="num text-meta text-ink-faint mt-0.5 font-mono">
                  {step.n}
                </span>
                <div>
                  <h3 className="text-subheading text-ink">{step.title}</h3>
                  <p className="text-small text-ink-body mt-1.5 max-w-md">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ── מה שחשוב לומר ───────────────────────────────────────── */}
        <section className="border-line border-t py-14">
          <h2 className="text-heading text-ink">רק מהחומר שלך</h2>
          <p className="text-small text-ink-body mt-4 max-w-lg">
            הסיכום, הכרטיסיות והשאלות נבנים אך ורק ממה שהעלית. המערכת לא מוסיפה ידע חיצוני
            ולא ממציאה — כדי שמה שתלמד יהיה מה שהמורה שלך נתן.
          </p>
        </section>
      </main>

      <footer className="border-line border-t">
        <div className="mx-auto flex max-w-3xl flex-col gap-2 px-5 py-8 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-meta text-ink-faint font-mono">{brand.name}</span>
          <span className="text-meta text-ink-faint">נבנה לתלמידים בישראל</span>
        </div>
      </footer>
    </>
  );
}
