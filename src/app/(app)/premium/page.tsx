import Link from 'next/link';

import { getEntitlements } from '@/lib/plans';

export const metadata = { title: 'המסלול המורחב' };

const included = [
  'העלאה של עד 15 חומרים בחודש',
  'מבחני תרגול — על נושא בודד או על כל החומר',
  'תוצאות עם נושאים חזקים וחלשים',
  'סיכום, כרטיסיות ותרגול, כמו במסלול החינמי',
];

export default async function PremiumPage() {
  const entitlements = await getEntitlements();

  if (entitlements.tier === 'premium') {
    return (
      <>
        <h1 className="text-heading text-ink">אתה במסלול המורחב</h1>
        <p className="text-small text-ink-body mt-2">
          העלית <span className="num">{entitlements.uploadsThisMonth}</span> חומרים החודש
          {entitlements.uploadsLimit ? (
            <>
              {' '}
              מתוך <span className="num">{entitlements.uploadsLimit}</span>
            </>
          ) : null}
          .
        </p>
        <Link
          href="/dashboard"
          className="border-line-input text-label text-ink hover:bg-surface-sunk mt-6 inline-block rounded-md border px-5 py-3"
        >
          לחומרים שלי
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="text-heading text-ink">המסלול המורחב</h1>
      <p className="text-small text-ink-body mt-2">
        במסלול החינמי אפשר חומר אחד, כדי לראות איך זה עובד. המסלול המורחב פותח את השאר.
      </p>

      <section className="border-line-strong mt-8 rounded-xl border px-5 py-6">
        <h2 className="text-subheading text-ink">מה כלול</h2>
        <ul className="mt-4 flex flex-col gap-3">
          {included.map((item) => (
            <li key={item} className="text-small text-ink-body flex gap-2.5">
              <span className="bg-correct mt-2 size-1.5 shrink-0 rounded-full" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      {/*
        אין כאן טופס תשלום, ובכוונה. חיבור לספק תשלומים עוד לא קיים,
        וטופס שנראה כמו תשלום ולא גובה הוא הטעיה.
      */}
      <div className="bg-surface-sunk mt-6 rounded-lg px-5 py-5">
        <p className="text-small text-ink-body">
          התשלום עדיין לא פתוח. אם אתה רוצה גישה מוקדמת, כתוב לנו ונפתח לך את המסלול
          ידנית.
        </p>
      </div>

      <Link
        href="/dashboard"
        className="border-line-input text-label text-ink hover:bg-surface-sunk mt-6 inline-block rounded-md border px-5 py-3"
      >
        חזרה לחומרים
      </Link>
    </>
  );
}
