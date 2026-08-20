import type { Metadata, Viewport } from 'next';
import { Assistant, JetBrains_Mono } from 'next/font/google';

import { brand } from '@/lib/brand';

import './globals.css';

/**
 * Assistant לעברית, JetBrains Mono למספרים ולמטא־דאטה.
 * next/font מארח את הקבצים אצלנו — בלי בקשה ל-Google מהדפדפן של התלמיד,
 * ובלי layout shift בטעינה.
 */
const assistant = Assistant({
  variable: '--font-assistant',
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: `${brand.name} — ${brand.tagline}`,
    template: `%s · ${brand.name}`,
  },
  description: brand.description,
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#FAFAF9',
  // mobile-first: הדף חייב להיות ניתן להגדלה. maximum-scale=1 חוסם זום
  // ונחשב כשל נגישות.
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="he"
      dir="rtl"
      className={`${assistant.variable} ${jetbrainsMono.variable} h-full`}
    >
      <body className="text-body flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
