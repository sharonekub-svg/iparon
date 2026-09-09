import type { Summary } from '@/lib/study';

/**
 * מסך הסיכום — הפיצ'ר המרכזי של המוצר.
 *
 * הסיכום מגיע כפרקים, ולכן הוא נקרא בקפיצות ולא כגוש אחד: לפני מבחן
 * תלמיד מחפש נושא, לא קורא מהתחלה. מכאן שלושה דברים בעיצוב:
 *
 * 1. **מפתח פרקים בראש**, עם עוגנים — הקפיצה היא הדרך שבה קוראים כאן.
 * 2. **מספר פרק בשוליים**, כדי שהמיקום בתוך החומר יהיה גלוי תמיד.
 * 3. **מידת שורה מוגבלת** (~62 תווים). טקסט עברי רץ לרוחב הטלפון קריא;
 *    לרוחב מסך מלא הוא כבר לא, והעין מאבדת את תחילת השורה הבאה.
 *
 * חומר שעובד לפני שהפרקים נוספו מגיע עם sections ריק, ואז מוצג body
 * כפי שהוא — בלי מפתח ובלי מספור, כי אין מה למספר.
 */

const MEASURE = 'max-w-[62ch]';

export function SummaryView({ summary, topics }: { summary: Summary; topics: string[] }) {
  const sections =
    summary.sections?.length > 0
      ? summary.sections
      : [{ heading: '', body: summary.body }];

  const chaptered = sections.filter((s) => s.heading).length > 1;

  return (
    <article className="flex flex-col gap-12">
      {/* מפתח הפרקים — לא קישוט, זו הדרך להגיע לנושא בערב המבחן */}
      {chaptered ? (
        <nav aria-label="פרקי הסיכום" className="border-line rounded-2xl border">
          <h2 className="text-meta text-ink-faint border-line border-b px-4 py-3">
            בסיכום
          </h2>
          <ol className="flex flex-col">
            {sections.map((section, i) =>
              section.heading ? (
                <li key={i} className="border-line border-b last:border-b-0">
                  <a
                    href={`#chapter-${i}`}
                    className="text-body text-ink-body hover:bg-surface hover:text-ink tap flex min-h-12 items-center gap-3 px-4 py-3"
                  >
                    <span className="num text-meta text-ink-faintest font-mono">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="flex-1 text-balance">{section.heading}</span>
                  </a>
                </li>
              ) : null,
            )}
          </ol>
        </nav>
      ) : null}

      {/* עיקרי הדברים לפני הסיכום המלא: מי שחוזר בערב המבחן מתחיל מכאן */}
      {summary.key_points.length > 0 ? (
        <section className="bg-ink shadow-lift rounded-2xl px-6 py-7">
          <h2 className="text-meta text-on-ink/50">עיקרי הדברים</h2>
          <ul className="mt-5 flex flex-col gap-4">
            {summary.key_points.map((point, i) => (
              <li key={i} className="flex gap-3.5">
                <span className="num text-meta text-on-ink/40 mt-1 shrink-0 font-mono">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="text-body text-on-ink">{point}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex flex-col gap-11">
        {sections.map((section, i) => (
          <section key={i} id={`chapter-${i}`} className="scroll-mt-6">
            {section.heading ? (
              <header className="border-line border-b pb-3">
                {chaptered ? (
                  <p className="text-meta text-ink-faintest font-mono">
                    {/* .num על ה-span ולא על הפסקה: על בלוק הוא היה מיישר אותו לשמאל */}
                    <span className="num">{String(i + 1).padStart(2, '0')}</span>
                  </p>
                ) : null}
                <h2 className="text-heading text-ink mt-1 text-balance">
                  {section.heading}
                </h2>
              </header>
            ) : null}
            <div className={`${MEASURE} mt-5 flex flex-col gap-4`}>
              {blocks(section.body).map((block, j) =>
                block.kind === 'list' ? (
                  <ul key={j} className="flex flex-col gap-2.5">
                    {block.items.map((item, k) => (
                      <li key={k} className="text-body text-ink-body flex gap-3">
                        <span
                          aria-hidden="true"
                          className="bg-ink-faintest mt-2.5 size-1.5 shrink-0 rounded-full"
                        />
                        <span className="flex-1">{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p key={j} className="text-body text-ink-body">
                    {block.text}
                  </p>
                ),
              )}
            </div>
          </section>
        ))}
      </div>

      {summary.definitions.length > 0 ? (
        <section>
          <h2 className="text-heading text-ink border-line border-b pb-3">מושגים</h2>
          <dl className="mt-5 grid gap-2.5 sm:grid-cols-2">
            {summary.definitions.map((def) => (
              <div
                key={def.term}
                className="border-line-strong bg-surface shadow-card rounded-xl border px-4 py-3.5"
              >
                <dt className="text-subheading text-ink text-balance">{def.term}</dt>
                <dd className="text-small text-ink-body mt-1">{def.meaning}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {/* הנושאים הם המפתח לתרגול ולמבחן, ולכן הם סוגרים את הדף ולא פותחים אותו */}
      {topics.length > 0 ? (
        <section className="border-line border-t pt-6">
          <h2 className="text-meta text-ink-faint">נושאים בחומר</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {topics.map((topic) => (
              <li
                key={topic}
                className="border-line-strong text-meta text-ink-body rounded-full border px-3 py-1.5"
              >
                {topic}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}

type Block = { kind: 'para'; text: string } | { kind: 'list'; items: string[] };

const BULLET = /^\s*[-–—•*]\s+/;

/**
 * הסיכום מגיע כטקסט. המודל מייצר לפעמים רשימות עם מקף בתחילת שורה,
 * וכגוש פסקה אחת הן נראות כמו שורות שנשברו באמצע. כאן הן הופכות
 * לרשימה אמיתית — ופסקה רגילה נשארת פסקה.
 */
function blocks(body: string): Block[] {
  return body
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const lines = chunk.split('\n').filter((line) => line.trim());
      if (lines.every((line) => BULLET.test(line))) {
        return {
          kind: 'list' as const,
          items: lines.map((line) => line.replace(BULLET, '').trim()),
        };
      }
      // פסקה שנשברה לשורות היא פסקה אחת; שבירת השורה של המודל אינה משמעות
      return { kind: 'para' as const, text: chunk.replace(/\n/g, ' ') };
    });
}
