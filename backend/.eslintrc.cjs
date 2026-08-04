module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: false
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  ignorePatterns: ['dist/**', 'node_modules/**', '**/*.js', '**/*.cjs'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/ban-types': 'off',
    '@typescript-eslint/no-var-requires': 'off',
    '@typescript-eslint/no-require-imports': 'off',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
    ],
    'no-console': 'off',
    'no-empty': ['error', { allowEmptyCatch: true }],
    'no-case-declarations': 'off',
    'prefer-const': 'warn',
    'no-useless-escape': 'warn',
    'no-useless-catch': 'warn',
    'no-constant-condition': 'warn',
    'no-control-regex': 'warn'
  }
};
