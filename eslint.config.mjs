import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import pluginReact from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  { ignores: ['dist/**'] },
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    plugins: { js },
    extends: ['js/recommended'],
    languageOptions: { globals: globals.browser },
    settings: { react: { version: 'detect' } },
  },
  tseslint.configs.recommended,
  pluginReact.configs.flat.recommended,
  pluginReact.configs.flat['jsx-runtime'],
  reactHooks.configs.flat.recommended,
  prettierRecommended,
  {
    rules: {
      'prettier/prettier': ['warn', { endOfLine: 'lf' }],
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    // Внутри Mini App нельзя дёргать env: confirmOnStand() вызывает
    // window.confirm, а в Telegram WebView это выглядит поломкой приложения.
    // Сборка гоняет eslint, значит нарушение не доедет до production.
    files: ['src/tg/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@/lib/env',
              message:
                'confirmOnStand() вызывает window.confirm — в Telegram WebView это недопустимо.',
            },
          ],
        },
      ],
    },
  },
]);
