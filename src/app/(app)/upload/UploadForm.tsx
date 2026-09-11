'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  cancelUpload,
  estimatePages,
  prepareUpload,
  registerDocuments,
  startProcessing,
} from './actions';

import { ProgressBar } from '@/components/ui/ProgressBar';
import { createBrowserSupabase } from '@/lib/supabase/browser';
import { describeRejection, uploadLimits } from '@/lib/validation/upload';

type Phase = 'idle' | 'uploading' | 'estimating' | 'confirming' | 'starting';

/** מה שמוצג לאישור לפני שהיתרה יורדת. */
type Estimate = { studySetId: string; pages: number; charged: number };

/** "0.0MB" על קובץ של 40KB נראה כמו באג. */
function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export function UploadForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [uploaded, setUploaded] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<Estimate | null>(null);

  // נגזר מהקבצים ולא מוחזק ב-state: setState בתוך effect גורר רינדור
  // מדורג, וכאן אין שום דבר שצריך להיזכר בין רינדורים.
  const previews = useMemo(() => {
    const urls: Record<string, string> = {};
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        urls[`${file.name}:${file.size}`] = URL.createObjectURL(file);
      }
    }
    return urls;
  }, [files]);

  // object URL תופס זיכרון עד שמשחררים אותו במפורש
  useEffect(() => {
    return () => Object.values(previews).forEach(URL.revokeObjectURL);
  }, [previews]);

  function accept(incoming: File[]) {
    // מוסיפים למה שכבר נבחר, ולא מחליפים: צילום של כמה עמודים נעשה
    // לרוב בכמה פעימות.
    const merged = [...files, ...incoming].filter(
      (file, i, all) =>
        all.findIndex((f) => f.name === file.name && f.size === file.size) === i,
    );

    const rejection = describeRejection(merged);
    if (rejection) {
      setError(rejection);
      return;
    }
    setError(null);
    setFiles(merged);
  }

  function remove(target: File) {
    setFiles(files.filter((f) => !(f.name === target.name && f.size === target.size)));
    setError(null);
  }

  async function submit() {
    if (files.length === 0) return;

    setPhase('uploading');
    setUploaded(0);
    setError(null);

    const prepared = await prepareUpload(
      files.map((f) => ({ name: f.name, size: f.size, type: f.type })),
    );

    if (!prepared.ok) {
      setError(prepared.error);
      setPhase('idle');
      return;
    }

    const { studySetId, targets } = prepared.data;
    const supabase = createBrowserSupabase();
    const docs: { path: string; size: number; mimeType: string }[] = [];

    for (const [i, target] of targets.entries()) {
      const { error: uploadError } = await supabase.storage
        .from('materials')
        .uploadToSignedUrl(target.path, target.token, files[i]);

      if (uploadError) {
        console.error('[upload:put]', uploadError.message);
        setError('ההעלאה נכשלה באמצע. בדוק את החיבור ונסה שוב.');
        setPhase('idle');
        return;
      }

      docs.push({ path: target.path, size: files[i].size, mimeType: target.mimeType });
      setUploaded(i + 1);
    }

    const registered = await registerDocuments(studySetId, docs);

    if (!registered.ok) {
      setError(registered.error);
      setPhase('idle');
      return;
    }

    // עוצרים להצגת מחיר. מצגת של 40 שקפים דלילים מחויבת ב-40 עמודים,
    // כי כל שקף נשלח למודל כתמונה — וזה בדיוק סוג ההפתעה שגורמת
    // לתלמיד להרגיש מרומה.
    setPhase('estimating');
    const estimated = await estimatePages(studySetId);

    if (!estimated.ok) {
      setError(estimated.error);
      setPhase('idle');
      return;
    }

    setEstimate({ studySetId, ...estimated.data });
    setPhase('confirming');
  }

  async function confirm() {
    if (!estimate) return;

    setPhase('starting');
    const started = await startProcessing(estimate.studySetId);

    if (!started.ok) {
      setError(started.error);
      setPhase('confirming');
      return;
    }

    router.push(`/sets/${estimate.studySetId}/processing`);
  }

  const busy = phase !== 'idle';

  return (
    <div className="mt-8 flex flex-col gap-5">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          accept(Array.from(e.dataTransfer.files));
        }}
      >
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className={`tap flex w-full flex-col items-center gap-3 rounded-2xl border border-dashed px-5 py-14 disabled:opacity-50 ${
            dragging
              ? 'border-ink bg-surface shadow-card'
              : 'border-line-dashed hover:border-ink hover:bg-surface'
          }`}
        >
          <span
            aria-hidden="true"
            className="border-line-strong text-ink flex size-12 items-center justify-center rounded-full border"
          >
            <svg
              viewBox="0 0 24 24"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 16V4M12 4 7.5 8.5M12 4l4.5 4.5M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16" />
            </svg>
          </span>
          <span className="text-subheading text-ink">
            {files.length > 0 ? 'הוסף עוד עמודים' : 'בחר קובץ או צלם דף'}
          </span>
          <span className="text-meta text-ink-faint">
            עד <span className="num">{uploadLimits.maxFiles}</span> עמודים · PDF, JPG או
            PNG
          </span>
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        multiple
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          accept(Array.from(e.target.files ?? []));
          // מאפשר לבחור שוב את אותו קובץ אחרי הסרה
          e.target.value = '';
        }}
      />

      {files.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {files.map((file) => {
            const key = `${file.name}:${file.size}`;
            const preview = previews[key];

            return (
              <li
                key={key}
                className="border-line-strong bg-surface shadow-card flex items-center gap-3 rounded-xl border p-2.5"
              >
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={preview}
                    alt=""
                    className="border-line size-12 shrink-0 rounded-sm border object-cover"
                  />
                ) : (
                  <span className="bg-surface-sunk text-meta text-ink-muted flex size-12 shrink-0 items-center justify-center rounded-sm font-mono">
                    PDF
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <p className="text-small text-ink truncate">{file.name}</p>
                  <p className="num text-meta text-ink-faint font-mono">
                    {formatSize(file.size)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => remove(file)}
                  disabled={busy}
                  aria-label={`הסר את ${file.name}`}
                  className="text-ink-faint hover:text-ink hover:bg-surface-sunk flex size-9 shrink-0 items-center justify-center rounded-md transition-colors disabled:opacity-40"
                >
                  <svg
                    viewBox="0 0 16 16"
                    aria-hidden="true"
                    className="size-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                  >
                    <path d="M4 4l8 8M12 4l-8 8" />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="text-small bg-wrong-soft text-wrong rounded-md px-4 py-3"
        >
          {error}
        </p>
      ) : null}

      {phase === 'uploading' ? (
        <div className="flex flex-col gap-2">
          <p className="text-small text-ink-body">
            מעלה <span className="num">{uploaded}</span> מתוך{' '}
            <span className="num">{files.length}</span>...
          </p>
          <ProgressBar value={uploaded} max={files.length} />
        </div>
      ) : null}

      {estimate ? (
        <div className="border-line-strong bg-surface shadow-card rounded-2xl border px-5 py-6">
          <h2 className="text-subheading text-ink">
            החומר הזה יעלה <span className="num">{estimate.charged}</span> עמודים
          </h2>

          <p className="text-small text-ink-body mt-2">
            {estimate.charged > estimate.pages ? (
              <>
                בחומר יש <span className="num">{estimate.pages}</span> עמודים, והחיוב
                המינימלי לחומר הוא <span className="num">{estimate.charged}</span>.
              </>
            ) : (
              'כל עמוד נספר, גם עמוד שיש בו מעט טקסט — המערכת קוראת כל עמוד כתמונה שלמה.'
            )}
          </p>

          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
            <button
              type="button"
              onClick={confirm}
              disabled={phase === 'starting'}
              className="bg-ink text-on-ink text-label tap rounded-lg px-6 py-3.5 hover:opacity-90 disabled:opacity-50"
            >
              {phase === 'starting' ? 'מתחיל עיבוד...' : 'להתחיל'}
            </button>
            <button
              type="button"
              onClick={async () => {
                await cancelUpload(estimate.studySetId);
                setEstimate(null);
                setFiles([]);
                setPhase('idle');
              }}
              disabled={phase === 'starting'}
              className="border-line-input text-label text-ink hover:bg-surface-sunk tap rounded-lg border px-6 py-3.5 disabled:opacity-50"
            >
              ביטול
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={submit}
          disabled={busy || files.length === 0}
          className="bg-ink text-on-ink text-label tap rounded-lg px-6 py-4 hover:opacity-90 disabled:opacity-50"
        >
          {phase === 'estimating'
            ? 'בודק כמה עמודים...'
            : phase === 'uploading'
              ? 'מעלה...'
              : files.length > 1
                ? `העלה ${files.length} עמודים`
                : 'העלה'}
        </button>
      )}
    </div>
  );
}
