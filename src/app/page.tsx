import Link from 'next/link';

import { HeroCard } from '@/components/landing/HeroCard';
import { brand } from '@/lib/brand';

/**
 * דף הנחיתה. תפקידו להסביר את המוצר בכמה שניות ולהוציא את המבקר
 * להרשמה. ההסבר העיקרי הוא לא טקסט אלא כרטיסייה שאפשר להפוך —
 * המבקר מרגיש את המוצר לפני שהוא נרשם.
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

const outputs = [
  { title: 'סיכום', body: 'הנושאים, עיקרי הדברים והמושגים — מסודרים.' },
  { title: 'כרטיסיות', body: 'שאלה בצד אחד, תשובה בשני. הופכים ומדרגים.' },
  { title: 'תרגול', body: 'שאלות אמריקאיות עם משוב והסבר מיד אחרי כל בחירה.' },
  { title: 'מבחן', body: 'מבחן על נושא בודד, או מבחן משותף על כל החומר.' },
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
      <header className="border-line bg-paper/80 sticky top-0 z-10 border-b backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <span className="text-meta text-ink font-mono">{brand.name}</span>
          <div className="flex items-center gap-1">
            <Link
              href="/login"
              className="text-label text-ink-muted hover:text-ink tap rounded-md px-3 py-2"
            >
              כניסה
            </Link>
            <Link
              href="/signup"
              className="bg-ink text-label text-on-ink tap rounded-md px-4 py-2 hover:opacity-90"
            >
              הרשמה
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-5">
        {/* ── הירו ────────────────────────────────────────────────── */}
        <section className="grid gap-12 pt-14 pb-20 sm:pt-20 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:gap-16">
          <div>
            <p className="rise border-line-strong text-meta text-ink-body inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
              <span aria-hidden="true" className="bg-ink size-1.5 rounded-full" />
              עברית, מהמחברת שלך
            </p>

            <h1
              className="rise text-display sm:text-hero text-ink mt-5"
              style={{ '--rise-delay': '60ms' } as React.CSSProperties}
            >
              תצלם את המחברת.
              <br />
              קבל מבחן.
            </h1>

            <p
              className="rise text-lead text-ink-body mt-6 max-w-md text-pretty"
              style={{ '--rise-delay': '120ms' } as React.CSSProperties}
            >
              סיכום מלא, כרטיסיות ומבחן תרגול — מכל דף שתעלה. בעברית, ורק מהחומר שלך.
            </p>

            <div
              className="rise mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
              style={{ '--rise-delay': '180ms' } as React.CSSProperties}
            >
              <Link
                href="/signup"
                className="bg-ink text-label text-on-ink shadow-card tap inline-flex items-center justify-center gap-2 rounded-lg px-7 py-4 hover:opacity-90"
              >
                התחל ללמוד
                <ArrowStart />
              </Link>
              <Link
                href="/demo"
                className="border-line-input text-label text-ink hover:bg-surface-sunk tap inline-flex items-center justify-center rounded-lg border px-7 py-4"
              >
                נסה בלי הרשמה
              </Link>
            </div>

            <p
              className="rise text-meta text-ink-faint mt-5"
              style={{ '--rise-delay': '240ms' } as React.CSSProperties}
            >
              חינם להתחלה. בלי כרטיס אשראי.
            </p>
          </div>

          <div
            className="rise"
            style={{ '--rise-delay': '300ms' } as React.CSSProperties}
          >
            <HeroCard />
          </div>
        </section>

        {/* ── מה מקבלים ───────────────────────────────────────────── */}
        <section aria-labelledby="outputs-heading" className="border-line border-t py-14">
          <h2 id="outputs-heading" className="text-heading text-ink text-balance">
            העלאה אחת, ארבעה כלים
          </h2>
          <p className="text-small text-ink-body mt-3 max-w-md">
            אין צורך לבקש כל דבר בנפרד. החומר עובר עיבוד אחד, ומה שיוצא ממנו מחכה
            בלשוניות.
          </p>

          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {outputs.map((item) => (
              <li
                key={item.title}
                className="border-line-strong bg-surface shadow-card rounded-2xl border px-5 py-5"
              >
                <h3 className="text-subheading text-ink">{item.title}</h3>
                <p className="text-small text-ink-body mt-1.5">{item.body}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ── איך זה עובד ─────────────────────────────────────────── */}
        <section aria-labelledby="how-heading" className="border-line border-t py-14">
          <h2 id="how-heading" className="text-heading text-ink">
            איך זה עובד
          </h2>
          <ol className="mt-8 grid gap-8 sm:grid-cols-3">
            {steps.map((step) => (
              <li key={step.n}>
                <span className="num text-display text-ink-faintest block font-mono">
                  {step.n}
                </span>
                <h3 className="text-subheading text-ink mt-2">{step.title}</h3>
                <p className="text-small text-ink-body mt-1.5">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ── מה שחשוב לומר ───────────────────────────────────────── */}
        <section className="pt-14 pb-16">
          <div className="bg-ink shadow-lift rounded-2xl px-6 py-12 text-center sm:px-12 sm:py-16">
            <h2 className="text-display text-on-ink mx-auto max-w-lg text-balance">
              רק מהחומר שלך
            </h2>
            <p className="text-lead text-on-ink/70 mx-auto mt-5 max-w-lg text-pretty">
              הסיכום, הכרטיסיות והשאלות נבנים אך ורק ממה שהעלית. המערכת לא מוסיפה ידע
              חיצוני ולא ממציאה — כדי שמה שתלמד יהיה מה שהמורה שלך נתן.
            </p>
            <Link
              href="/signup"
              className="bg-on-ink text-label text-ink tap mt-8 inline-flex items-center justify-center gap-2 rounded-lg px-7 py-4 hover:opacity-90"
            >
              התחל ללמוד
              <ArrowStart />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-line border-t">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-5 py-8 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-meta text-ink-faint font-mono">{brand.name}</span>
          <span className="text-meta text-ink-faint">נבנה לתלמידים בישראל</span>
        </div>
      </footer>
    </>
  );
}
