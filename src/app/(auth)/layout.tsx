import Link from 'next/link';

import { brand } from '@/lib/brand';

export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-line border-b">
        <div className="mx-auto max-w-3xl px-5 py-4">
          <Link href="/" className="text-meta text-ink font-mono">
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
