module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  env: {
    browser: true,
    es2020: true,
    webextensions: true,
  },
  rules: {
    // Disallow debug logs in production code
    'no-console': ['warn', { allow: ['error', 'warn'] }],

    // TypeScript
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^(h|Fragment)$', ignoreRestSiblings: true }],
    '@typescript-eslint/explicit-module-boundary-types': 'off',

    // Preact JSX uses h() pragma - no React import needed
    'no-undef': 'off',
  },
  ignorePatterns: ['dist/', 'node_modules/', '*.js', '!.eslintrc.js'],
};
