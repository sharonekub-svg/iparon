'use client';

import { useActionState } from 'react';

import { signIn, type AuthState } from '../actions';

import { Field } from '@/components/ui/Field';
import { FormMessage } from '@/components/ui/FormMessage';
import { SubmitButton } from '@/components/ui/SubmitButton';

const initialState: AuthState = {};

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-4">
      <FormMessage error={state.error} notice={state.notice} />
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <Field label="אימייל" name="email" type="email" autoComplete="email" required />
      <Field
        label="סיסמה"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />

      <SubmitButton pendingLabel="רגע...">כניסה</SubmitButton>
    </form>
  );
}
