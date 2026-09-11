'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { retryProcessing } from '@/app/(app)/sets/[id]/actions';
import { getProgress } from '@/app/(app)/upload/actions';
import { IconMark } from '@/components/ui/IconMark';

/**
 * מסך העיבוד.
 *
 * השלבים שמוצגים הם השלבים שבאמת רצים — העובד מעדכן את עמודת stage,
 * והמסך קורא אותה. **אין כאן סרגל התקדמות באחוזים**: אי אפשר לדעת כמה
 * נשאר, ומספר שרץ ל-90% ונתקע הוא שקר שהתלמיד מזהה.
 */
const STAGES = [
  { key: 'queued', label: 'החומר התקבל' },
  { key: 'reading', label: 'קורא את הדפים' },
  { key: 'analyzing', label: 'מנתח את החומר ומסדר את הנושאים' },
  { key: 'writing', label: 'כותב את הסיכום ובונה שאלות' },
] as const;

export function ProcessingStatus({ studySetId }: { studySetId: string }) {
  const router = useRouter();
  const [stage, setStage] = useState('queued');
  const [chunk, setChunk] = useState({ index: 0, count: 1 });
  const [failed, setFailed] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function poll() {
      const progress = await getProgress(studySetId);
      if (!alive || !progress) return;

      setStage(progress.stage);
      setChunk({ index: progress.chunkIndex, count: progress.chunkCount });

      if (progress.status === 'ready') {
        router.replace(`/sets/${studySetId}`);
        return;
      }
      if (progress.status === 'failed') {
        setFailed(progress.error ?? 'העיבוד נכשל');
        return;
      }

      timer = setTimeout(poll, 2500);
    }

    let timer = setTimeout(poll, 400);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [studySetId, router]);

  async function retry() {
    setRetrying(true);
    setRetryError(null);

    const result = await retryProcessing(studySetId);

    if (!result.ok) {
      setRetryError(result.error);
      setRetrying(false);
      return;
    }

    // חוזרים למעקב. הקבצים כבר באחסון, ולכן זו לא העלאה חדשה.
    setFailed(null);
    setStage('queued');
    setRetrying(false);
  }

  if (failed) {
    return (
      <div className="border-line-strong bg-surface shadow-card rounded-2xl border px-5 py-8">
        <h1 className="text-heading text-ink">העיבוד נכשל</h1>
        <p className="text-small text-ink-body mt-2">{failed}</p>

        {retryError ? (
          <p
            role="alert"
            className="text-small bg-wrong-soft text-wrong mt-4 rounded-md px-4 py-3"
          >
            {retryError}
          </p>
        ) : null}

        <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
          <button
            type="button"
            onClick={retry}
            disabled={retrying}
            className="bg-ink text-on-ink text-label tap rounded-lg px-6 py-3.5 hover:opacity-90 disabled:opacity-50"
          >
            {retrying ? 'מתחיל...' : 'נסה שוב'}
          </button>
          <Link
            href="/dashboard"
            className="border-line-input text-label text-ink hover:bg-surface-sunk tap rounded-lg border px-6 py-3.5 text-center"
          >
            לחומרים שלי
          </Link>
        </div>

        <p className="text-meta text-ink-faint mt-4">
          הקבצים שהעלית שמורים, והעמודים הוחזרו ליתרה. ניסיון חוזר לא עולה לך שוב.
        </p>
      </div>
    );
  }

  const current = STAGES.findIndex((s) => s.key === stage);

  return (
    <div>
      <h1 className="text-display text-ink text-balance">עוד רגע ואתה מוכן ללמוד</h1>
      <p className="text-small text-ink-body mt-3">
        אפשר לסגור את המסך — העיבוד ממשיך, והחומר יחכה לך ברשימה.
      </p>

      {/*
        חומר גדול מעובד במנות של 20 עמודים, וזה לוקח כמה דקות. בלי
        השורה הזאת המסך נראה תקוע בדיוק כשהוא הכי עסוק.
      */}
      {chunk.count > 1 ? (
        <p className="text-meta text-ink-faint mt-2">
          חומר ארוך, אז הוא מעובד בחלקים — חלק{' '}
          <span className="num">{Math.min(chunk.index + 1, chunk.count)}</span> מתוך{' '}
          <span className="num">{chunk.count}</span>.
        </p>
      ) : null}

      <ol className="border-line-strong bg-surface shadow-card mt-8 flex flex-col rounded-2xl border px-5 py-2">
        {STAGES.map((item, i) => {
          const done = current > i;
          const active = current === i;

          return (
            <li
              key={item.key}
              className="border-line flex items-center gap-3 border-b py-4 last:border-b-0"
            >
              <span
                aria-hidden="true"
                className={`flex size-6 shrink-0 items-center justify-center rounded-full border ${
                  done
                    ? 'border-ink bg-ink text-on-ink'
                    : active
                      ? 'border-ink text-ink'
                      : 'border-line-strong text-ink-faintest'
                }`}
              >
                {done ? (
                  <IconMark kind="check" className="size-3.5" />
                ) : active ? (
                  <span className="bg-ink size-2 animate-pulse rounded-full" />
                ) : (
                  <span className="bg-line-strong size-1.5 rounded-full" />
                )}
              </span>
              <span
                className={`text-body ${
                  done
                    ? 'text-ink-faint'
                    : active
                      ? 'text-ink font-semibold'
                      : 'text-ink-faintest'
                }`}
              >
                {item.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
