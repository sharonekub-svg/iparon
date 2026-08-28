'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { retryProcessing } from '@/app/(app)/sets/[id]/actions';
import { getProgress } from '@/app/(app)/upload/actions';

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
  const [failed, setFailed] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function poll() {
      const progress = await getProgress(studySetId);
      if (!alive || !progress) return;

      setStage(progress.stage);

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
      <div className="border-line rounded-lg border px-5 py-8">
        <h1 className="text-subheading text-ink">העיבוד נכשל</h1>
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
            className="bg-ink text-on-ink text-label rounded-md px-5 py-3 disabled:opacity-50"
          >
            {retrying ? 'מתחיל...' : 'נסה שוב'}
          </button>
          <Link
            href="/dashboard"
            className="border-line-input text-label text-ink hover:bg-surface-sunk rounded-md border px-5 py-3 text-center"
          >
            לחומרים שלי
          </Link>
        </div>

        <p className="text-meta text-ink-faint mt-4">
          הקבצים שהעלית שמורים. ניסיון חוזר לא מבזבז לך עוד העלאה.
        </p>
      </div>
    );
  }

  const current = STAGES.findIndex((s) => s.key === stage);

  return (
    <div>
      <h1 className="text-heading text-ink">עוד רגע ואתה מוכן ללמוד</h1>
      <p className="text-small text-ink-body mt-2">
        אפשר לסגור את המסך — העיבוד ממשיך, והחומר יחכה לך ברשימה.
      </p>

      <ol className="mt-8 flex flex-col gap-4">
        {STAGES.map((item, i) => {
          const done = current > i;
          const active = current === i;

          return (
            <li key={item.key} className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className={`size-2 shrink-0 rounded-full ${
                  done ? 'bg-correct' : active ? 'bg-ink animate-pulse' : 'bg-line-strong'
                }`}
              />
              <span
                className={`text-body ${
                  done ? 'text-ink-faint' : active ? 'text-ink' : 'text-ink-faintest'
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
