module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  ignorePatterns: ['dist/**', 'node_modules/**', 'tmp-screenshots/**', '**/*.js', '**/*.cjs'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
    ],
    '@typescript-eslint/no-empty-function': 'off',
    'no-console': 'off',
    'no-useless-escape': 'warn',
    'no-prototype-builtins': 'off',
    'no-empty': ['warn', { allowEmptyCatch: true }],
    'no-case-declarations': 'off',
    'prefer-const': 'warn'
  }
};
