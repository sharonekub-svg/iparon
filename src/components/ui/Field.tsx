type FieldProps = {
  label: string;
  name: string;
  type?: 'text' | 'email' | 'password';
  autoComplete?: string;
  required?: boolean;
  hint?: string;
  defaultValue?: string;
};

/**
 * שדה טופס. `dir` נקבע לפי הסוג: אימייל וסיסמה הם תוכן לטיני, ושדה
 * ימני מציג אותם עם הסמן בצד הלא נכון ועם סימני פיסוק שקופצים למקום
 * אחר. התווית נשארת בעברית ומיושרת לימין.
 */
export function Field({
  label,
  name,
  type = 'text',
  autoComplete,
  required,
  hint,
  defaultValue,
}: FieldProps) {
  const isLatin = type === 'email' || type === 'password';

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-label text-ink">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        dir={isLatin ? 'ltr' : 'rtl'}
        autoComplete={autoComplete}
        required={required}
        defaultValue={defaultValue}
        aria-describedby={hint ? `${name}-hint` : undefined}
        className="border-line-input text-body text-ink placeholder:text-ink-faintest focus:border-ink rounded-xl border bg-white px-4 py-3.5 transition-colors outline-none"
      />
      {hint ? (
        <p id={`${name}-hint`} className="text-meta text-ink-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
