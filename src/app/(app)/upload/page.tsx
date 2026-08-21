import { UploadForm } from './UploadForm';

export const metadata = { title: 'העלאת חומר' };

export default function UploadPage() {
  return (
    <>
      <h1 className="text-heading text-ink">העלאת חומר</h1>
      <p className="text-small text-ink-body mt-2">
        סיכום, דף מחברת מצולם, או PDF של פרק שלם. גם כתב יד.
      </p>
      <UploadForm />
    </>
  );
}
