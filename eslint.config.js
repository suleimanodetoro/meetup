/* eslint-env node */
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      'dist/**',
      '.expo/**',
      'android/**',
      'ios/**',
      'supabase/.temp/**',
      'components/worldMapData.ts',
    ],
  },
  {
    rules: {
      'react/display-name': 'off',
    },
  },
  {
    files: ['supabase/functions/**/*.ts'],
    rules: {
      // Edge Functions are Deno programs. ESLint's Node resolver cannot
      // resolve their supported https: imports, and Deno permits Array<T>.
      'import/no-unresolved': 'off',
      '@typescript-eslint/array-type': 'off',
    },
  },
]);
