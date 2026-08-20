/**
 * הודעת שגיאה או אישור מעל הטופס.
 * role="alert" כדי שקורא מסך יקריא אותה כשהיא מופיעה.
 */
export function FormMessage({ error, notice }: { error?: string; notice?: string }) {
  if (!error && !notice) return null;

  const isError = Boolean(error);

  return (
    <p
      role="alert"
      className={`text-small rounded-md px-3.5 py-3 ${
        isError ? 'bg-wrong-soft text-wrong' : 'bg-correct-soft text-correct'
      }`}
    >
      {error ?? notice}
    </p>
  );
}
