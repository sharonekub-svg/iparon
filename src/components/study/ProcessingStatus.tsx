'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

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

  if (failed) {
    return (
      <div className="border-line rounded-lg border px-5 py-8">
        <h1 className="text-subheading text-ink">העיבוד נכשל</h1>
        <p className="text-small text-ink-body mt-2">{failed}</p>
        <a
          href="/upload"
          className="border-line-input text-label text-ink hover:bg-surface-sunk mt-5 inline-block rounded-md border px-5 py-2.5"
        >
          לנסות שוב
        </a>
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
