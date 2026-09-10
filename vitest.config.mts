import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // `server-only` נפתר כאן לגרסת הלקוח וזורק בעצם הייבוא. הקבצים
      // שמסומנים בו הם קוד שרת, ובדיקה שלהם ב-node היא בדיקה לגיטימית —
      // הסימון קיים כדי לחסום ייבוא מהדפדפן, לא מהבדיקות.
      'server-only': fileURLToPath(
        new URL('./node_modules/server-only/empty.js', import.meta.url),
      ),
    },
  },
});
