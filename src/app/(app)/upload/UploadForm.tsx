'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { prepareUpload, startProcessing } from './actions';

import { createBrowserSupabase } from '@/lib/supabase/browser';
import { describeRejection, uploadLimits } from '@/lib/validation/upload';

type Phase = 'idle' | 'uploading' | 'starting';

export function UploadForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [uploaded, setUploaded] = useState(0);
  const [error, setError] = useState<string | null>(null);

  function pick(list: FileList | null) {
    if (!list) return;
    const chosen = Array.from(list);
    const rejection = describeRejection(chosen);
    setError(rejection);
    setFiles(rejection ? [] : chosen);
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

    setPhase('starting');
    const started = await startProcessing(studySetId, docs);

    if (!started.ok) {
      setError(started.error);
      setPhase('idle');
      return;
    }

    router.push(`/sets/${studySetId}/processing`);
  }

  const busy = phase !== 'idle';

  return (
    <div className="mt-8 flex flex-col gap-5">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="border-line-dashed hover:bg-surface-sunk flex flex-col items-center gap-2 rounded-lg border border-dashed px-5 py-10 transition-colors disabled:opacity-50"
      >
        <span className="text-label text-ink">בחר קובץ או צלם דף</span>
        <span className="text-meta text-ink-faint">
          עד <span className="num">{uploadLimits.maxFiles}</span> עמודים · PDF, JPG או PNG
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        multiple
        // capture פותח את המצלמה ישירות בטלפון
        capture="environment"
        className="sr-only"
        onChange={(e) => pick(e.target.files)}
      />

      {files.length > 0 ? (
        <ul className="border-line divide-line divide-y rounded-md border">
          {files.map((file) => (
            <li key={file.name} className="flex items-center justify-between px-4 py-3">
              <span className="text-small text-ink truncate">{file.name}</span>
              <span className="num text-meta text-ink-faint font-mono">
                {(file.size / 1024 / 1024).toFixed(1)}MB
              </span>
            </li>
          ))}
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
        <p className="text-small text-ink-body">
          מעלה <span className="num">{uploaded}</span> מתוך{' '}
          <span className="num">{files.length}</span>...
        </p>
      ) : null}

      <button
        type="button"
        onClick={submit}
        disabled={busy || files.length === 0}
        className="bg-ink text-on-ink text-label rounded-md px-6 py-3.5 disabled:opacity-50"
      >
        {phase === 'starting'
          ? 'מתחיל עיבוד...'
          : phase === 'uploading'
            ? 'מעלה...'
            : 'העלה'}
      </button>
    </div>
  );
}
