import Link from 'next/link';

import { LoginForm } from './LoginForm';

export const metadata = { title: 'כניסה' };

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const { next } = await searchParams;

  return (
    <>
      <h1 className="text-heading text-ink">כניסה</h1>
      <p className="text-small text-ink-body mt-2">טוב לראות אותך שוב.</p>

      <LoginForm next={typeof next === 'string' ? next : undefined} />

      <p className="text-small text-ink-muted mt-8">
        אין לך עדיין חשבון?{' '}
        <Link href="/signup" className="text-ink underline underline-offset-4">
          הרשמה
        </Link>
      </p>
    </>
  );
}
