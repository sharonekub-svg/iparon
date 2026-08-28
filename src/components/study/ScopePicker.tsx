'use client';

import { IconMark } from '@/components/ui/IconMark';

/**
 * בחירת ההיקף — לתרגול ולמבחן כאחד.
 *
 * הבחירה היא **מרובה** ולא אחת מיני רבות: מבחן אמיתי הוא לרוב צירוף
 * של נושאים ("תורשה ומערכת העיכול") ולא נושא בודד ולא הכול. "כל החומר"
 * אינו פריט ברשימה אלא מתג שמסמן את כולם, ולכן אפשר גם להתחיל מהכול
 * ולהוריד נושא אחד.
 */

export type ScopeItem = { id: string; name: string; available: number };

export function ScopePicker({
  title,
  items,
  selected,
  onChange,
}: {
  title: string;
  items: ScopeItem[];
  /** מזהי הנושאים שנבחרו */
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const all = selected.length === items.length;
  const chosen = new Set(selected);
  const total = items.reduce((sum, item) => sum + item.available, 0);
  const picked = items
    .filter((item) => chosen.has(item.id))
    .reduce((sum, item) => sum + item.available, 0);

  function toggle(id: string) {
    // לא מאפשרים לרוקן את הבחירה — מבחן בלי נושא אינו מבחן
    if (chosen.has(id)) {
      if (selected.length === 1) return;
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  return (
    <section>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-subheading text-ink">{title}</h2>
        <span className="text-meta text-ink-faint font-mono">
          <span className="num">{picked}</span> מתוך <span className="num">{total}</span>
        </span>
      </div>

      <button
        type="button"
        onClick={() => onChange(all ? [items[0].id] : items.map((i) => i.id))}
        aria-pressed={all}
        className={`text-label tap mt-3 flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-start ${
          all
            ? 'border-ink bg-ink text-on-ink'
            : 'border-line-input text-ink-body hover:border-ink hover:bg-surface'
        }`}
      >
        <Box checked={all} tone={all ? 'on-ink' : 'ink'} />
        <span className="flex-1">כל החומר</span>
        <span className="text-meta opacity-60">
          <span className="num">{items.length}</span> נושאים
        </span>
      </button>

      <div className="mt-2 flex flex-col gap-2">
        {items.map((item) => {
          const active = chosen.has(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => toggle(item.id)}
              aria-pressed={active}
              className={`text-body tap flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-start ${
                active
                  ? 'border-ink bg-surface text-ink shadow-card'
                  : 'border-line-input text-ink-faint hover:border-ink hover:bg-surface'
              }`}
            >
              <Box checked={active} tone="ink" />
              <span className="flex-1">{item.name}</span>
              <span className="text-meta text-ink-faint font-mono">
                <span className="num">{item.available}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Box({ checked, tone }: { checked: boolean; tone: 'ink' | 'on-ink' }) {
  return (
    <span
      aria-hidden="true"
      className={`flex size-5 shrink-0 items-center justify-center rounded-md border ${
        checked
          ? tone === 'on-ink'
            ? 'border-on-ink bg-on-ink text-ink'
            : 'border-ink bg-ink text-on-ink'
          : 'border-line-input'
      }`}
    >
      {checked ? <IconMark kind="check" className="size-3" /> : null}
    </span>
  );
}
