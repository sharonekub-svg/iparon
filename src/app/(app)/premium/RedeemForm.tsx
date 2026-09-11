'use client';

import { useActionState } from 'react';

import { redeemCode } from './actions';

import { FormMessage } from '@/components/ui/FormMessage';
import { SubmitButton } from '@/components/ui/SubmitButton';

type State = { error?: string; notice?: string } | null;

/**
 * הקלדת קוד הפעלה. זה המסלול של מי ששילם ידנית — בביט או בהעברה —
 * וקיבל קוד בוואטסאפ.
 */
export function RedeemForm() {
  const [state, action] = useActionState<State, FormData>(
    async (_prev, formData) => redeemCode(formData),
    null,
  );

  return (
    <form action={action} className="mt-6 flex flex-col gap-3">
      <label htmlFor="code" className="text-label text-ink">
        יש לך קוד הפעלה?
      </label>

      <FormMessage error={state?.error} notice={state?.notice} />

      <input
        id="code"
        name="code"
        required
        dir="ltr"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        placeholder="LAMDAI-XXXX-XXXX"
        className="border-line-input text-ink bg-paper min-h-12 rounded-lg border px-4 py-3 text-start font-mono"
      />

      <SubmitButton pendingLabel="בודקים את הקוד">להפעיל את הקוד</SubmitButton>
    </form>
  );
}
