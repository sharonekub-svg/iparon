'use client';

import { useActionState } from 'react';

import { startCheckout } from './actions';

import { FormMessage } from '@/components/ui/FormMessage';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { priceDigits, type Pack } from '@/lib/pricing';

/**
 * הכפתור שמוביל לתשלום על חבילה אחת. הפעולה מסתיימת ב-redirect לדף
 * המאורח של ספק התשלומים, ולכן ה-state חוזר רק כשמשהו נכשל.
 */
export function CheckoutForm({ pack }: { pack: Pack }) {
  const [state, action] = useActionState<{ error: string } | null, FormData>(
    async (_prev, formData) => (await startCheckout(formData)) ?? null,
    null,
  );

  return (
    <form action={action} className="mt-5 flex flex-col gap-3">
      <input type="hidden" name="pack" value={pack.slug} />
      <FormMessage error={state?.error} />
      <SubmitButton pendingLabel="רגע, פותחים תשלום">
        לתשלום — <span className="num">{priceDigits(pack)}</span> ₪
      </SubmitButton>
    </form>
  );
}
