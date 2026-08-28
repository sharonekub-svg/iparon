import Link from 'next/link';

import { DemoSkip } from '@/components/ui/DemoSkip';
import { demoLoginEnabled } from '@/lib/env';

import { SignupForm } from './SignupForm';

export const metadata = { title: 'הרשמה' };

export default function SignupPage() {
  return (
    <>
      <h1 className="text-display text-ink">הרשמה</h1>
      <p className="text-small text-ink-body mt-2">חשבון חינם. לוקח פחות מדקה.</p>

      <SignupForm />

      {demoLoginEnabled() ? <DemoSkip /> : null}

      <p className="text-small text-ink-muted mt-8">
        כבר יש לך חשבון?{' '}
        <Link href="/login" className="text-ink underline underline-offset-4">
          כניסה
        </Link>
      </p>
    </>
  );
}
