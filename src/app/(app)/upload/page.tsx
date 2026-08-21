import Link from 'next/link';

import { UploadForm } from './UploadForm';

import { getEntitlements, getUploadAllowance } from '@/lib/plans';

export const metadata = { title: 'העלאת חומר' };

export default async function UploadPage() {
  const [allowance, entitlements] = await Promise.all([
    getUploadAllowance(),
    getEntitlements(),
  ]);

  if (!allowance.allowed) {
    return (
      <>
        <h1 className="text-heading text-ink">נגמרה המכסה</h1>
        <p className="text-small text-ink-body mt-2">{allowance.reason}</p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {entitlements.tier === 'free' ? (
            <Link
              href="/premium"
              className="bg-ink text-on-ink text-label rounded-md px-5 py-3 text-center"
            >
              מה כלול במסלול המורחב
            </Link>
          ) : null}
          <Link
            href="/dashboard"
            className="border-line-input text-label text-ink hover:bg-surface-sunk rounded-md border px-5 py-3 text-center"
          >
            לחומרים שלי
          </Link>
        </div>
      </>
    );
  }

  const remaining =
    entitlements.uploadsLimit === null
      ? null
      : entitlements.uploadsLimit - entitlements.uploadsThisMonth;

  return (
    <>
      <h1 className="text-heading text-ink">העלאת חומר</h1>
      <p className="text-small text-ink-body mt-2">
        סיכום, דף מחברת מצולם, או PDF של פרק שלם. גם כתב יד.
      </p>
      {remaining !== null ? (
        <p className="text-meta text-ink-faint mt-2">
          נשארו לך <span className="num">{remaining}</span> העלאות
          {entitlements.tier === 'free' ? ' במסלול החינמי' : ' החודש'}.
        </p>
      ) : null}
      <UploadForm />
    </>
  );
}
