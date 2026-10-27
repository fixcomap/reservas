// Lint de la API (Node, CommonJS). Lo ejecuta el pipeline estándar con `npm run lint`.
const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  js.configs.recommended,
  {
    languageOptions: { ecmaVersion: 2024, sourceType: 'commonjs', globals: globals.node },
    rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_|^next$' }] },
  },
];
