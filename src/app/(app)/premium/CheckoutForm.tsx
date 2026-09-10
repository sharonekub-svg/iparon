'use client';

import { useActionState } from 'react';

import { startCheckout } from './actions';

import { FormMessage } from '@/components/ui/FormMessage';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { priceDigits } from '@/lib/pricing';

/**
 * הכפתור שמוביל לתשלום. הפעולה מסתיימת ב-redirect לדף המאורח של ספק
 * התשלומים, ולכן ה-state חוזר רק כשמשהו נכשל.
 */
export function CheckoutForm() {
  const [state, action] = useActionState(
    async () => (await startCheckout()) ?? null,
    null,
  );

  return (
    <form action={action} className="mt-6 flex flex-col gap-3">
      <FormMessage error={state?.error} />
      <SubmitButton pendingLabel="רגע, פותחים תשלום">
        לתשלום — <span className="num">{priceDigits}</span> ₪ לחודש
      </SubmitButton>
      <p className="text-meta text-ink-faint">
        החיוב מתבצע בדף המאובטח של ספק הסליקה. פרטי האשראי לא עוברים דרכנו ולא נשמרים
        אצלנו.
      </p>
    </form>
  );
}
