'use client';

import { useActionState } from 'react';

import { signUp, type AuthState } from '../actions';

import { Field } from '@/components/ui/Field';
import { FormMessage } from '@/components/ui/FormMessage';
import { SubmitButton } from '@/components/ui/SubmitButton';

const initialState: AuthState = {};

export function SignupForm() {
  const [state, formAction] = useActionState(signUp, initialState);

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-4">
      <FormMessage error={state.error} notice={state.notice} />

      <Field label="איך קוראים לך?" name="displayName" autoComplete="name" />
      <Field label="אימייל" name="email" type="email" autoComplete="email" required />
      <Field
        label="סיסמה"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint="לפחות 8 תווים"
      />

      <SubmitButton pendingLabel="רגע...">יוצרים חשבון</SubmitButton>
    </form>
  );
}
