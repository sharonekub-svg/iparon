import Link from 'next/link';

import { CheckoutForm } from './CheckoutForm';

import { FormMessage } from '@/components/ui/FormMessage';
import { payplusConfigured } from '@/lib/payments/payplus';
import { getEntitlements } from '@/lib/plans';
import { priceDigits } from '@/lib/pricing';

export const metadata = { title: 'המסלול המורחב' };

const included = [
  'העלאה של עד 10 חומרים בחודש',
  'סיכום מלא, כרטיסיות ותרגול לכל חומר',
  'תרגול על נושא אחד, על צירוף נושאים, או על הכול',
  'מבחן מלא על החומר, עם ציון ומעקב',
  'מעקב אחרי הנושאים החזקים והחלשים שלך',
];

export default async function PremiumPage(props: PageProps<'/premium'>) {
  const [entitlements, params] = await Promise.all([
    getEntitlements(),
    props.searchParams,
  ]);

  const status = typeof params.status === 'string' ? params.status : null;

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
        החומר הראשון חינם, כדי שתראה מה יוצא לך. מכאן זה מסלול בתשלום.
      </p>

      {/*
        המשתמש חוזר לכאן מדף התשלום. השדרוג עצמו לא נסמך על החזרה הזאת
        אלא על ה-callback החתום מהספק, ולכן הניסוח זהיר: ייתכן שהאישור
        עוד בדרך.
      */}
      {status === 'success' ? (
        <div className="mt-6">
          <FormMessage notice="התשלום נקלט. פתיחת המסלול לוקחת עד דקה — רענן את הדף אם עוד לא נפתח." />
        </div>
      ) : null}
      {status === 'failure' ? (
        <div className="mt-6">
          <FormMessage error="התשלום לא הושלם. לא חויבת. אפשר לנסות שוב." />
        </div>
      ) : null}

      <section className="border-line-strong mt-8 rounded-xl border px-5 py-6">
        <div className="flex items-baseline gap-2">
          <span className="text-display text-ink">
            <span className="num">{priceDigits}</span> ₪
          </span>
          <span className="text-small text-ink-faint">לחודש</span>
        </div>

        <h2 className="text-subheading text-ink mt-6">מה כלול</h2>
        <ul className="mt-4 flex flex-col gap-3">
          {included.map((item) => (
            <li key={item} className="text-small text-ink-body flex gap-2.5">
              <span className="bg-correct mt-2 size-1.5 shrink-0 rounded-full" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      {payplusConfigured() ? (
        <CheckoutForm />
      ) : (
        /*
          אין מפתחות סליקה — ולכן אין כפתור תשלום. כפתור שנראה כמו תשלום
          ולא גובה הוא הטעיה, וזו בדיוק התלונה החוזרת על Turbo.
        */
        <div className="bg-surface-sunk mt-6 rounded-lg px-5 py-5">
          <p className="text-small text-ink-body">
            התשלום עדיין לא פתוח. אם אתה רוצה גישה מוקדמת, כתוב לנו ונפתח לך את המסלול
            ידנית.
          </p>
        </div>
      )}

      <Link
        href="/dashboard"
        className="border-line-input text-label text-ink hover:bg-surface-sunk mt-6 inline-block rounded-md border px-5 py-3"
      >
        חזרה לחומרים
      </Link>
    </>
  );
}
