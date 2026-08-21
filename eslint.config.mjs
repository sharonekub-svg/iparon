import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // קובץ העיצוב מ-Claude Design ו-runtime שלו. קוד מיובא, לא נערך כאן.
    'design/**',
    // קוד Deno, לא קוד האתר. נבדק ב-deno check.
    'supabase/functions/**',
  ]),
]);

export default eslintConfig;
