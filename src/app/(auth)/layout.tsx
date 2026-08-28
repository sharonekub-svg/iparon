import Link from 'next/link';

import { brand } from '@/lib/brand';

export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-line border-b">
        <div className="mx-auto max-w-3xl px-5 py-2.5">
          <Link
            href="/"
            className="text-meta text-ink tap -ms-3 inline-flex min-h-11 items-center rounded-lg px-3 font-mono"
          >
            {brand.name}
          </Link>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5 py-12">
        {children}
      </main>
    </div>
  );
}
