import Link from 'next/link';

import { CheckoutForm } from './CheckoutForm';
import { RedeemForm } from './RedeemForm';

import { FormMessage } from '@/components/ui/FormMessage';
import { contactUrl } from '@/lib/env';
import { payplusConfigured } from '@/lib/payments/payplus';
import { getEntitlements } from '@/lib/plans';
import { packs, perPageDigits, priceDigits } from '@/lib/pricing';

export const metadata = { title: 'עמודים' };

export default async function PremiumPage(props: PageProps<'/premium'>) {
  const [entitlements, params] = await Promise.all([
    getEntitlements(),
    props.searchParams,
  ]);

  const status = typeof params.status === 'string' ? params.status : null;
  const contact = contactUrl();
  const canPay = payplusConfigured();

  return (
    <>
      <h1 className="text-heading text-ink">עמודים</h1>
      <p className="text-small text-ink-body mt-2">
        {entitlements.freeUsed ? (
          <>
            נשארו לך <span className="num">{entitlements.credits}</span> עמודים. כל עמוד
            שהמערכת קוראת יורד מהיתרה, ומה שנוצר ממנו — סיכום, כרטיסיות, תרגול ומבחן —
            נשאר שלך בלי הגבלה.
          </>
        ) : (
          'החומר הראשון שלך חינם, בכל גודל. אחריו קונים עמודים, ומה שנוצר מהם נשאר שלך בלי הגבלה.'
        )}
      </p>

      {/*
        המשתמש חוזר לכאן מדף התשלום. הזיכוי עצמו לא נסמך על החזרה הזאת
        אלא על ה-callback החתום מהספק, ולכן הניסוח זהיר.
      */}
      {status === 'success' ? (
        <div className="mt-6">
          <FormMessage notice="התשלום נקלט. העמודים נכנסים תוך כדקה — רענן את הדף אם עוד לא." />
        </div>
      ) : null}
      {status === 'failure' ? (
        <div className="mt-6">
          <FormMessage error="התשלום לא הושלם. לא חויבת. אפשר לנסות שוב." />
        </div>
      ) : null}

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {packs.map((pack) => (
          <section
            key={pack.slug}
            className={`rounded-xl border px-5 py-6 ${
              pack.featured ? 'border-line-strong bg-surface shadow-card' : 'border-line'
            }`}
          >
            <h2 className="text-subheading text-ink">{pack.title}</h2>
            <p className="text-meta text-ink-faint mt-1">{pack.subtitle}</p>

            <p className="text-display text-ink mt-4">
              <span className="num">{priceDigits(pack)}</span> ₪
            </p>
            <p className="text-small text-ink-body mt-1">
              <span className="num">{pack.pages}</span> עמודים ·{' '}
              <span className="num">{perPageDigits(pack)}</span> אגורות לעמוד
            </p>

            {canPay ? <CheckoutForm pack={pack} /> : null}
          </section>
        ))}
      </div>

      <p className="text-meta text-ink-faint mt-4">
        העמודים לא פגים ולא מתאפסים בסוף החודש. אין מנוי ואין חיוב חוזר — משלמים פעם אחת,
        וזהו. חומר קצר מחויב במינימום של <span className="num">5</span> עמודים.
      </p>

      {canPay ? null : (
        /*
          אין מפתחות סליקה, ולכן אין כפתור תשלום — כפתור שנראה כמו תשלום
          ולא גובה הוא הטעיה. במקומו: רכישה בשיחה, ואחריה קוד הפעלה.
        */
        <div className="bg-surface-sunk mt-6 rounded-lg px-5 py-5">
          <p className="text-small text-ink-body">
            התשלום באתר עוד לא פתוח, ובינתיים הרכישה נעשית בשיחה: כותבים לי, מעבירים
            תשלום, ומקבלים קוד שמוסיף את העמודים.
          </p>

          {contact ? (
            <a
              href={contact}
              className="bg-ink text-on-ink text-label tap mt-4 inline-block rounded-lg px-6 py-3.5 hover:opacity-90"
            >
              לכתוב לי על חבילה
            </a>
          ) : null}
        </div>
      )}

      <RedeemForm />

      <Link
        href="/dashboard"
        className="border-line-input text-label text-ink hover:bg-surface-sunk mt-6 inline-block rounded-md border px-5 py-3"
      >
        חזרה לחומרים
      </Link>
    </>
  );
}
