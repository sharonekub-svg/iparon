'use client';

import { useState } from 'react';

import { renameStudySet } from '@/app/(app)/sets/[id]/actions';

/**
 * כותרת החומר, שניתן לערוך במקום.
 * המודל בוחר את השם ולא תמיד קולע, ותלמיד שמחפש "מערכת העיכול" לא
 * ימצא חומר שנקרא "פרק 4".
 */
export function StudySetTitle({
  studySetId,
  initialTitle,
}: {
  studySetId: string;
  initialTitle: string;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialTitle);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    const result = await renameStudySet(studySetId, draft);
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setTitle(result.data);
    setError(null);
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="mt-3 flex items-start gap-2">
        <h1 className="text-heading text-ink flex-1">{title}</h1>
        <button
          type="button"
          onClick={() => {
            setDraft(title);
            setEditing(true);
          }}
          aria-label="שינוי שם החומר"
          className="text-ink-faint hover:text-ink hover:bg-surface-sunk mt-1 flex size-8 shrink-0 items-center justify-center rounded-md transition-colors"
        >
          <svg
            viewBox="0 0 16 16"
            aria-hidden="true"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M11.5 2.5a1.4 1.4 0 0 1 2 2L6 12l-3 1 1-3z" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      <input
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void save();
          if (e.key === 'Escape') setEditing(false);
        }}
        aria-label="שם החומר"
        className="border-line-input text-heading text-ink focus:border-ink rounded-md border bg-white px-3 py-2 outline-none"
      />

      {error ? (
        <p role="alert" className="text-small text-wrong">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="bg-ink text-on-ink text-label rounded-md px-4 py-2 disabled:opacity-50"
        >
          {saving ? 'שומר...' : 'שמור'}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          disabled={saving}
          className="border-line-input text-label text-ink hover:bg-surface-sunk rounded-md border px-4 py-2"
        >
          ביטול
        </button>
      </div>
    </div>
  );
}
