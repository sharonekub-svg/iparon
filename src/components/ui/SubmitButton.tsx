'use client';

import { useFormStatus } from 'react-dom';

/**
 * כפתור שליחה שמכבה את עצמו בזמן הפעולה. בלי זה, לחיצה כפולה על
 * רשת סלולרית איטית שולחת את הטופס פעמיים.
 */
export function SubmitButton({
  children,
  pendingLabel,
}: {
  children: React.ReactNode;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-ink text-on-ink text-label rounded-md px-6 py-3.5 transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
