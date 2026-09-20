import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // Bootstrap and jQuery are third-party files copied in as they were published.
  globalIgnores(['dist', 'coverage', 'public/about/vendor']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['**/*.test.{js,jsx}', 'src/test/**'],
    languageOptions: { globals: { ...globals.browser, ...globals.node, ...globals.vitest } },
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    // The public page's own scripts: plain browser scripts, with jQuery and one global they publish.
    files: ['public/about/*.js'],
    languageOptions: { sourceType: 'script', globals: { ...globals.browser, jQuery: 'readonly', CampusValidate: 'readonly' } },
  },
  {
    files: ['vite.config.js'],
    languageOptions: { globals: globals.node },
  },
])
