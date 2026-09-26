// ESLint flat config (ESLint 9+). Replaces the legacy .eslintrc.json, which
// ESLint 9+ no longer reads by default. Only two rules are enforced; no-undef
// is deliberately not on, so no globals package is needed to keep this
// dependency-free.
export default [
  {
    ignores: ['node_modules/**', '**/dist/**']
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module'
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }]
    }
  }
];
